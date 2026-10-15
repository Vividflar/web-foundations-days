-- School database: students, courses and enrolments (SQLite)
-- Run the whole file first, then run each numbered query on its own.
 
PRAGMA foreign_keys = ON;  -- SQLite only enforces foreign keys when this is on
 
-- Start clean so the file can be run again (children first, parents last)
DROP TABLE IF EXISTS enrolments;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;
 
-- =====================================================
-- Tables
-- =====================================================
 
CREATE TABLE students (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,            -- no two students share an email
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);
 
CREATE TABLE courses (
  id      INTEGER PRIMARY KEY,
  title   TEXT NOT NULL UNIQUE,
  teacher TEXT NOT NULL
);
 
-- Join table: one row = one student enrolled on one course
CREATE TABLE enrolments (
  id          INTEGER PRIMARY KEY,
  student_id  INTEGER NOT NULL,
  course_id   INTEGER NOT NULL,
  grade       INTEGER CHECK (grade BETWEEN 0 AND 100),  -- NULL until the student is graded
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id)  REFERENCES courses(id)  ON DELETE CASCADE,
  UNIQUE (student_id, course_id)               -- the same student cannot enrol on the same course twice
);
 
-- Index: speeds up "which students are on this course?" and "students per course"
CREATE INDEX idx_enrolments_course_id ON enrolments(course_id);
 
-- =====================================================
-- Sample data
-- =====================================================
 
INSERT INTO students (name, email) VALUES
  ('Amina Otieno',  'amina@example.com'),
  ('Brian Kamau',   'brian@example.com'),
  ('Chloe Nkosi',   'chloe@example.com'),
  ('David Mwangi',  'david@example.com'),
  ('Esther Wanjiru','esther@example.com');
 
INSERT INTO courses (title, teacher) VALUES
  ('Web Development Foundations', 'Ms Achieng'),
  ('Databases',                   'Mr Otieno'),
  ('Python Basics',               'Ms Njeri'),
  ('UI Design Basics',            'Mr Kimani');
 
INSERT INTO enrolments (student_id, course_id, grade) VALUES
  (1, 1, 85),     -- Amina    - Web Development Foundations
  (1, 2, 78),     -- Amina    - Databases
  (2, 1, 92),     -- Brian    - Web Development Foundations
  (2, 3, 88),     -- Brian    - Python Basics
  (3, 1, NULL),   -- Chloe    - Web Development Foundations (not graded yet)
  (3, 2, 64),     -- Chloe    - Databases
  (4, 3, 71);     -- David    - Python Basics
-- Esther has no enrolments; nobody is enrolled on UI Design Basics yet.
 
-- This would FAIL (same student, same course) because of UNIQUE (student_id, course_id):
-- INSERT INTO enrolments (student_id, course_id) VALUES (1, 1);
 
-- =====================================================
-- Queries
-- =====================================================
 
-- 1. All courses for one student (by name)
SELECT students.name, courses.title, courses.teacher, enrolments.grade
FROM students
JOIN enrolments ON enrolments.student_id = students.id
JOIN courses    ON courses.id = enrolments.course_id
WHERE students.name = 'Amina Otieno'
ORDER BY courses.title;
 
-- 2. All students on one course
SELECT courses.title, students.name, students.email, enrolments.grade
FROM courses
JOIN enrolments ON enrolments.course_id = courses.id
JOIN students   ON students.id = enrolments.student_id
WHERE courses.title = 'Web Development Foundations'
ORDER BY students.name;
 
-- 3. Number of students per course (LEFT JOIN keeps courses with 0 students)
SELECT courses.title, COUNT(enrolments.id) AS number_of_students
FROM courses
LEFT JOIN enrolments ON enrolments.course_id = courses.id
GROUP BY courses.id, courses.title
ORDER BY number_of_students DESC, courses.title;
 
-- 4. Students who have no enrolments
SELECT students.id, students.name, students.email
FROM students
LEFT JOIN enrolments ON enrolments.student_id = students.id
WHERE enrolments.id IS NULL;
 
-- 5. Update one enrolment's grade: Chloe's grade in Databases becomes 72
UPDATE enrolments
SET grade = 72
WHERE student_id = (SELECT id FROM students WHERE name = 'Chloe Nkosi')
  AND course_id  = (SELECT id FROM courses  WHERE title = 'Databases');
 
-- Check the update worked
SELECT students.name, courses.title, enrolments.grade
FROM enrolments
JOIN students ON students.id = enrolments.student_id
JOIN courses  ON courses.id  = enrolments.course_id
WHERE students.name = 'Chloe Nkosi';
 