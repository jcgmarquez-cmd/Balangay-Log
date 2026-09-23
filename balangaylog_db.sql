-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Sep 23, 2026 at 03:04 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `balangaylog_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `case_milestones`
--

CREATE TABLE `case_milestones` (
  `id` int(11) NOT NULL,
  `incident_id` int(11) NOT NULL,
  `tracking_id` varchar(30) NOT NULL,
  `status_snapshot` varchar(50) NOT NULL,
  `officer_in_charge` varchar(120) DEFAULT NULL,
  `deployed_unit` varchar(100) DEFAULT NULL,
  `action_note` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `case_milestones`
--

INSERT INTO `case_milestones` (`id`, `incident_id`, `tracking_id`, `status_snapshot`, `officer_in_charge`, `deployed_unit`, `action_note`, `created_at`) VALUES
(1, 1, 'TRK-2026-001', 'PENDING', NULL, NULL, 'Initial report logged as Noise Disturbance. Priority: Moderate (Score: 40).', '2026-09-22 07:10:40'),
(2, 2, 'TRK-2026-002', 'CRITICAL', NULL, NULL, 'Initial report logged as Property Dispute. Priority: Critical (Score: 85).', '2026-09-22 07:11:53'),
(3, 3, 'TRK-2026-003', 'PENDING', NULL, NULL, 'Initial report logged as Physical Altercation. Priority: Low (Score: 20).', '2026-09-22 07:12:30'),
(4, 4, 'TRK-2026-004', 'PENDING', NULL, NULL, 'Initial report logged as Others. Priority: Moderate (Score: 40).', '2026-09-22 07:24:48');

-- --------------------------------------------------------

--
-- Table structure for table `incident_reports`
--

CREATE TABLE `incident_reports` (
  `id` int(11) NOT NULL,
  `reference_number` varchar(30) NOT NULL,
  `complainant_name` varchar(120) NOT NULL,
  `complainant_phone` varchar(30) NOT NULL,
  `incident_type` varchar(100) NOT NULL,
  `narrative_description` text NOT NULL,
  `incident_datetime` datetime NOT NULL,
  `purok` varchar(60) NOT NULL,
  `latitude` decimal(10,8) NOT NULL DEFAULT 14.54530000,
  `longitude` decimal(11,8) NOT NULL DEFAULT 120.57390000,
  `scenario_type` enum('WALK_IN','ONLINE_PORTAL','EMERGENCY') DEFAULT 'WALK_IN',
  `verification_level` enum('VERIFIED','UNVERIFIED') DEFAULT 'VERIFIED',
  `ai_urgency_score` decimal(4,2) DEFAULT 0.00,
  `priority_level` enum('Low','Moderate','High','Critical') DEFAULT 'Moderate',
  `ai_recommendation` text DEFAULT NULL,
  `status` enum('PENDING','IN_PROGRESS','FOR_RESOLUTION','RESOLVED','CRITICAL') DEFAULT 'PENDING',
  `assigned_officer_id` int(11) DEFAULT NULL,
  `assigned_officer_name` varchar(120) DEFAULT NULL,
  `deployed_unit` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `incident_reports`
--

INSERT INTO `incident_reports` (`id`, `reference_number`, `complainant_name`, `complainant_phone`, `incident_type`, `narrative_description`, `incident_datetime`, `purok`, `latitude`, `longitude`, `scenario_type`, `verification_level`, `ai_urgency_score`, `priority_level`, `ai_recommendation`, `status`, `assigned_officer_id`, `assigned_officer_name`, `deployed_unit`, `created_at`) VALUES
(1, 'TRK-2026-001', 'Ligaya', '09318091210', 'Noise Disturbance', 'a', '2026-09-22 09:10:40', 'Sitio Masaya', 14.54530000, 120.57390000, 'WALK_IN', 'VERIFIED', 40.00, 'Moderate', 'Eligible for Katarungang Pambarangay. Issue notice to summon for Lupon mediation.', 'PENDING', NULL, NULL, NULL, '2026-09-22 07:10:40'),
(2, 'TRK-2026-002', 'Ligaya', '09318091210', 'Property Dispute', 'm', '2026-09-22 09:11:53', 'Sitio Masaya', 14.54530000, 120.57390000, 'WALK_IN', 'VERIFIED', 85.00, 'Critical', 'Critical threat detected. Dispatch Immediate Response Unit and alert PNP.', 'CRITICAL', NULL, NULL, NULL, '2026-09-22 07:11:53'),
(3, 'TRK-2026-003', 'ligaya', '09318091210', 'Physical Altercation', 'gfhgf', '2026-09-22 09:12:30', 'Purok 3', 14.54530000, 120.57390000, 'WALK_IN', 'VERIFIED', 20.00, 'Low', 'Standard administrative intake. Log for regular review.', 'PENDING', NULL, NULL, NULL, '2026-09-22 07:12:30'),
(4, 'TRK-2026-004', 'a', 'a', 'Others', 'a', '2026-09-22 09:24:47', 'Purok 1', 14.54530000, 120.57390000, 'WALK_IN', 'VERIFIED', 40.00, 'Moderate', 'Eligible for Katarungang Pambarangay. Issue notice to summon for Lupon mediation.', 'IN_PROGRESS', NULL, NULL, NULL, '2026-09-22 07:24:47');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `full_name` varchar(120) NOT NULL,
  `email_or_phone` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `user_type` enum('RESIDENT','OFFICER','ADMIN','CAPTAIN') DEFAULT 'RESIDENT',
  `authorization_status` enum('PENDING','AUTHORIZED','DEACTIVATED') DEFAULT 'AUTHORIZED',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `case_milestones`
--
ALTER TABLE `case_milestones`
  ADD PRIMARY KEY (`id`),
  ADD KEY `incident_id` (`incident_id`);

--
-- Indexes for table `incident_reports`
--
ALTER TABLE `incident_reports`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `reference_number` (`reference_number`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email_or_phone` (`email_or_phone`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `case_milestones`
--
ALTER TABLE `case_milestones`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `incident_reports`
--
ALTER TABLE `incident_reports`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `case_milestones`
--
ALTER TABLE `case_milestones`
  ADD CONSTRAINT `case_milestones_ibfk_1` FOREIGN KEY (`incident_id`) REFERENCES `incident_reports` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
