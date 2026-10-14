# Library API Design: Books
 
A RESTful API for a library's `books` resource. Books are named with a plural noun, a single book is addressed by its id (for example `/books/42`), and the HTTP method says what to do.
 
## The book object
 
- `id` - number, set by the server
- `title` - string, required
- `author` - string, required
- `isbn` - string, optional
- `year` - number, optional (year of publication)
- `available` - boolean, `true` when the book is on the shelf
Example:
 
```json
{
  "id": 42,
  "title": "Things Fall Apart",
  "author": "Chinua Achebe",
  "isbn": "9780385474542",
  "year": 1958,
  "available": true
}
```
 
## Endpoints
 
### 1. List all books
 
- **Method and path:** `GET /books`
- **Description:** Returns an array of every book in the library.
- **Request body:** none
- **Success status:** `200 OK`
### 2. Get one book
 
- **Method and path:** `GET /books/42`
- **Description:** Returns the single book with id 42.
- **Request body:** none
- **Success status:** `200 OK`
### 3. Create a book
 
- **Method and path:** `POST /books`
- **Description:** Adds a new book; the server assigns the id and returns the created book.
- **Example request body:**
```json
{
  "title": "Weep Not, Child",
  "author": "Ngugi wa Thiong'o",
  "isbn": "9780435908300",
  "year": 1964
}
```
 
- **Success status:** `201 Created`
### 4. Replace a book
 
- **Method and path:** `PUT /books/42`
- **Description:** Replaces book 42 completely with the version in the body.
- **Example request body:**
```json
{
  "title": "Things Fall Apart",
  "author": "Chinua Achebe",
  "isbn": "9780385474542",
  "year": 1958,
  "available": false
}
```
 
- **Success status:** `200 OK`
### 5. Update part of a book
 
- **Method and path:** `PATCH /books/42`
- **Description:** Changes only the fields sent in the body, for example marking a book as checked out.
- **Example request body:**
```json
{
  "available": false
}
```
 
- **Success status:** `200 OK`
### 6. Delete a book
 
- **Method and path:** `DELETE /books/42`
- **Description:** Removes book 42 from the library.
- **Request body:** none
- **Success status:** `204 No Content` (nothing is sent back)
### 7. List books by an author
 
- **Method and path:** `GET /books?author=Chinua%20Achebe`
- **Description:** Returns only the books written by the given author. The author goes in a query parameter after the `?`.
- **Request body:** none
- **Success status:** `200 OK` (an empty array `[]` if the author has no books)
## Error codes
 
### 400 Bad Request
 
- **Meaning:** The request is invalid, so the server cannot process it.
- **Example 1:** `POST /books` with an empty title, `{ "title": "", "author": "Chinua Achebe" }`.
- **Example 2:** `PATCH /books/42` with `{ "year": "nineteen fifty-eight" }`, because `year` must be a number.
- **Example response body:**
```json
{
  "error": "Bad Request",
  "message": "The title is required and cannot be empty."
}
```
 
### 404 Not Found
 
- **Meaning:** The book or URL does not exist.
- **Example 1:** `GET /books/9999` when no book has id 9999.
- **Example 2:** `DELETE /books/42` after book 42 has already been deleted.
- **Example response body:**
```json
{
  "error": "Not Found",
  "message": "No book with id 9999 exists."
}
```
 