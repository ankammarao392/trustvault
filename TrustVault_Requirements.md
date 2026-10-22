# TrustVault: Secure Document Management Platform

Every company shares confidential documents: salary letters with employees, contracts with customers, drawings with external partners, audit papers with regulators. Two things go wrong, and both are expensive.

## The Two Main Problems

### 1. Permissions

Someone is given access to a folder so they can see one file, and they can now see forty. Someone leaves the company and their link still works. A file meant for one client is visible to another.

### 2. Lack of Accountability

The second is that nobody can answer the question afterwards. When a document leaks, the first question is always: **Who opened this, and when?**

If the honest answer is "we do not know", the company is in trouble with its customer, its auditor, or both.

## Project Objective

You are building **TrustVault**: a platform where the wrong person cannot reach a document, and where you can prove exactly who reached it.

> This is a security problem wearing the clothes of a CRUD application. The screens are straightforward. Making them actually safe is not, and that is what we are marking.

## What It Must Do

### 1. Authentication and Roles

- Implement authentication.
- Support at least three roles:
  - **Administrator**
  - **Document Owner**
  - **Viewer**
- Decide what each role can do and document those permissions clearly.

### 2. Document Management

- Upload documents.
- Organise documents into categories or folders.
- Search for documents.
- Manage existing documents.

### 3. Document-Level Permissions

- Set permissions for each individual document.
- Support at least two permission levels:
  - **Read:** View or download a document.
  - **Edit:** Modify a document.
- Grant permissions to specifically named users.
- Allow document owners to grant access and revoke it.

### 4. Access Control and Security

- Users who have not been granted access must not be able to:
  - Read a document.
  - Download a document.
  - Modify a document.
  - Delete a document.

### 5. Audit Trail

Maintain a record of important document activities, including:

- Document uploads.
- Document downloads.
- Document changes.
- Document deletions.
- Permission changes.

Each audit record should help establish **who performed an action and when it happened**.

### 6. Search and Filtering

Allow users to search or filter documents by:

- Document name.
- Document owner.
- Category.
- Date.

Search results must respect the user's permissions. Users should not discover confidential documents through search if they do not have access to them.

### 7. File Upload Validation

Validate uploaded files to ensure they meet the application's security and file-handling requirements.

### 8. Administrative Dashboard

Provide an administrative view that displays:

- Document activity.
- Permission changes.
- Relevant audit records.

### 9. Automated Security Tests

Write automated tests demonstrating that one user cannot access another user's documents without permission.

Tests should cover attempts to read, download, edit, and delete unauthorised documents.

## Expectations and Evaluation

The requirements listed above are the minimum baseline, and the list is deliberately short.

You have the freedom to decide how to implement the platform and what additional features to include.

A week is long enough to go well beyond the basic requirements. The additional features you choose to implement, as well as the features you deliberately decide not to implement, are part of the evaluation.

The goal is not simply to build a working document management application. It is to build a **secure, auditable, and reliable document management platform** and explain the reasoning behind your design decisions.
