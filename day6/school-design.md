# School Database Design
 
This database stores which students are enrolled on which courses, and the grade each student earned. It has three tables: `students`, `courses` and `enrolments`. The SQL is in `school.sql` and was written for SQLite.
 
## Tables
 
### students
 
- **What it holds:** one row for each student.
- **Columns:** `id` (primary key), `name`, `email` and `created_at`.
- **Rules:** `name` and `email` are `NOT NULL`, and `email` is `UNIQUE`, so two students can never share an email address.
### courses
 
- **What it holds:** one row for each course the school offers.
- **Columns:** `id` (primary key), `title` and `teacher`.
- **Rules:** both `title` and `teacher` are `NOT NULL`, and `title` is `UNIQUE`, so the same course is not listed twice.
### enrolments
 
- **What it holds:** one row for each fact "this student is enrolled on this course". It is the link between the other two tables.
- **Columns:** `id` (primary key), `student_id`, `course_id` and `grade`.
- **Foreign keys:** `student_id` points to `students.id` and `course_id` points to `courses.id`. Both use `ON DELETE CASCADE`, so deleting a student or a course also removes its enrolments instead of leaving orphan rows.
- **No double enrolling:** `UNIQUE (student_id, course_id)` stops the same student being enrolled on the same course twice.
- **Grade:** `grade` is a whole number from 0 to 100, enforced with a `CHECK` rule. It can be `NULL`, which means the student has not been graded yet.
## Relationships
 
- **students to enrolments is one-to-many.** One student can have many enrolments, but each enrolment belongs to exactly one student.
- **courses to enrolments is one-to-many.** One course can have many enrolments, but each enrolment belongs to exactly one course.
- **students to courses is many-to-many.** One student takes many courses, and one course has many students.
- **Why a join table is needed:** a column holds only one value, so neither table can store the link on its own. A `course_id` column in `students` would allow one course per student, and a list of student ids in `courses` would break the rule that each column holds one value. The `enrolments` table stores one pair of ids per row, which is exactly what a many-to-many relationship needs. It is also the natural place for the grade, because a grade belongs to the pair (this student on this course), not to the student or the course alone.
## Index
 
I would add an index on `enrolments(course_id)`:
 
```sql
CREATE INDEX idx_enrolments_course_id ON enrolments(course_id);
```
 
- **Reason:** "all students on one course" and "number of students per course" both look up enrolments by `course_id`. Without an index, the database reads every row in `enrolments` each time. With the index, it jumps straight to the matching rows.
- **Why not `student_id`:** the `UNIQUE (student_id, course_id)` rule already creates an index that starts with `student_id`, so lookups by student are covered. Lookups by `course_id` are not.
- **Trade-off:** every insert, update or delete on `enrolments` must also keep the index up to date, and the index takes extra space. For a table that is read far more often than it is written, that is a good deal.
## SQL or NoSQL?
 
I would choose SQL for this system. The data is clearly structured, because every student, course and enrolment has the same fixed fields. It is also built on relationships, since students and courses are linked many-to-many, and SQL is designed for that with foreign keys and `JOIN`. School records also need to be correct: the database itself refuses a duplicate email, a duplicate enrolment, an enrolment for a student who does not exist, or a grade of 150, whichever program or person makes the change. A document database such as MongoDB would store each student's courses inside the student document, so asking "who is on this course?" would be awkward, and the course details would be copied into many documents and could drift out of date. NoSQL would only become attractive if the data became very flexible or the system had to spread across many servers, and a school database is unlikely to need either.
 