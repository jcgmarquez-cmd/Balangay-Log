<?php
/**
 * Photos attached to incident reports (walk-in and online).
 * Files are stored under uploads/incident_photos/ with random names; the paths are kept in incident_photos.
 */

const CASE_PHOTO_MAX_FILES = 4;
const CASE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;   // 5 MB per photo
const CASE_PHOTO_DIR_REL   = 'uploads/incident_photos/';

function case_photos_table_ready(PDO $pdo): bool
{
    try {
        return (bool) $pdo->query("SHOW TABLES LIKE 'incident_photos'")->fetchColumn();
    } catch (Throwable $e) {
        return false;
    }
}

/** Turns $_FILES['photos'] (single or multiple) into a flat list of file entries. */
function case_photos_normalize($files): array
{
    if (!is_array($files) || !isset($files['name'])) {
        return [];
    }
    if (!is_array($files['name'])) {
        return [$files];
    }
    $out = [];
    foreach ($files['name'] as $i => $name) {
        $out[] = [
            'name'     => $name,
            'type'     => $files['type'][$i] ?? '',
            'tmp_name' => $files['tmp_name'][$i] ?? '',
            'error'    => $files['error'][$i] ?? UPLOAD_ERR_NO_FILE,
            'size'     => $files['size'][$i] ?? 0,
        ];
    }
    return $out;
}

/** Keeps the upload folder from listing its files or running scripts. */
function case_photos_protect_dir(string $dir): void
{
    if (!is_file($dir . 'index.html')) {
        @file_put_contents($dir . 'index.html', '');
    }
    if (!is_file($dir . '.htaccess')) {
        @file_put_contents($dir . '.htaccess',
            "<FilesMatch \"\\.(php|phtml|phar|php[0-9]?|pl|py|cgi|sh)$\">\n" .
            "    <IfModule mod_authz_core.c>\n        Require all denied\n    </IfModule>\n" .
            "    <IfModule !mod_authz_core.c>\n        Order allow,deny\n        Deny from all\n    </IfModule>\n" .
            "</FilesMatch>\n");
    }
}

/**
 * Validates and stores the uploaded photos for a case that is already saved.
 * Never throws: a bad photo is reported in 'rejected' and the case itself is left alone.
 * Returns ['saved' => [relative paths], 'rejected' => [messages]].
 */
function case_photos_save(PDO $pdo, int $incidentId, $files, ?int $userId): array
{
    $result = ['saved' => [], 'rejected' => []];
    $list = array_values(array_filter(
        case_photos_normalize($files),
        fn($f) => (int) ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE
    ));
    if (!$list) {
        return $result;
    }
    if (!case_photos_table_ready($pdo)) {
        $result['rejected'][] = 'photo storage is not set up yet (run incident_photos.sql)';
        return $result;
    }

    $dir = __DIR__ . '/../' . CASE_PHOTO_DIR_REL;
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
        error_log('[case_photos] could not create ' . $dir);
        $result['rejected'][] = 'the photo folder could not be created';
        return $result;
    }
    case_photos_protect_dir($dir);

    $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    $finfo = class_exists('finfo') ? new finfo(FILEINFO_MIME_TYPE) : null;
    $insert = $pdo->prepare(
        'INSERT INTO incident_photos (incident_id, file_path, original_name, mime_type, size_bytes, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?)'
    );

    foreach ($list as $i => $f) {
        $label = mb_substr(basename((string) ($f['name'] ?? 'photo')), 0, 60);
        $error = (int) ($f['error'] ?? UPLOAD_ERR_NO_FILE);

        if (count($result['saved']) >= CASE_PHOTO_MAX_FILES || $i >= CASE_PHOTO_MAX_FILES * 3) {
            $result['rejected'][] = "{$label} (only " . CASE_PHOTO_MAX_FILES . ' photos are allowed per report)';
            continue;
        }
        if ($error !== UPLOAD_ERR_OK) {
            $tooBig = in_array($error, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true);
            $result['rejected'][] = "{$label} (" . ($tooBig ? 'file is too large' : 'upload failed') . ')';
            continue;
        }
        $tmp  = (string) ($f['tmp_name'] ?? '');
        $size = (int) ($f['size'] ?? 0);
        if ($size <= 0 || $size > CASE_PHOTO_MAX_BYTES) {
            $result['rejected'][] = "{$label} (must be under 5 MB)";
            continue;
        }
        if (!is_uploaded_file($tmp)) {
            $result['rejected'][] = "{$label} (upload failed)";
            continue;
        }
        $mime = $finfo ? (string) $finfo->file($tmp) : (string) (@getimagesize($tmp)['mime'] ?? '');
        if (!isset($allowed[$mime]) || @getimagesize($tmp) === false) {
            $result['rejected'][] = "{$label} (not a JPG, PNG or WebP image)";
            continue;
        }

        $fileName = bin2hex(random_bytes(16)) . '.' . $allowed[$mime];
        if (!move_uploaded_file($tmp, $dir . $fileName)) {
            error_log('[case_photos] move failed for incident ' . $incidentId);
            $result['rejected'][] = "{$label} (could not be saved)";
            continue;
        }
        $relative = CASE_PHOTO_DIR_REL . $fileName;
        try {
            $insert->execute([$incidentId, $relative, mb_substr((string) ($f['name'] ?? ''), 0, 255), $mime, $size, $userId]);
            $result['saved'][] = $relative;
        } catch (Throwable $e) {
            @unlink($dir . $fileName);
            error_log('[case_photos] insert failed: ' . $e->getMessage());
            $result['rejected'][] = "{$label} (could not be recorded)";
        }
    }
    return $result;
}

/** Returns [incident_id => [relative photo paths]] for the heatmap feed. */
function case_photos_for_incidents(PDO $pdo, array $ids): array
{
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
    if (!$ids || !case_photos_table_ready($pdo)) {
        return [];
    }
    try {
        $in = implode(',', array_fill(0, count($ids), '?'));
        $st = $pdo->prepare("SELECT incident_id, file_path FROM incident_photos WHERE incident_id IN ({$in}) ORDER BY id ASC");
        $st->execute($ids);
        $map = [];
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $map[(int) $row['incident_id']][] = (string) $row['file_path'];
        }
        return $map;
    } catch (Throwable $e) {
        error_log('[case_photos] read failed: ' . $e->getMessage());
        return [];
    }
}