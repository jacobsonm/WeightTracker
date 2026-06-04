# Weight Tracker — Project Context

This document captures the intended scope and architecture direction for a learning application built to gain experience with AWS services.

## Purpose

Build a simple learning application to help gain hands-on experience using AWS services. The application allows users to track body weight.

## Core Features

- **Enter weigh-in information** — Users can record weight entries.
- **View weigh-in history** — History is available in:
  - Tabular format
  - Line graph

## Client Platforms

Users should be able to access the application via:

- Web browser
- iOS app
- Android app
- Windows application

### Offline and Sync (Mobile & Desktop)

The iOS, Android, and Windows applications should:

- Work when not connected to the Internet
- Sync with the backend when a connection is established

The storage mechanism for offline usage can be determined at a later time.

## Architecture Direction

### Data Layer

- **Amazon DynamoDB** — Primary data store

### Middle Layer

- **Amazon API Gateway**
- **AWS Lambda**

### Front End

- **Web client** — static HTML/CSS/JS in [`web/`](./web/), hosted on **S3** and served via **CloudFront** (HTTPS). The browser calls the existing **API Gateway** REST API (CORS enabled). See [`web/README.md`](./web/README.md).
- iOS, Android, and Windows clients — to be determined at a later date

### Other AWS Services

Additional AWS services may prove useful but can be evaluated later.

## Current state

The initial backend and web client are in place: DynamoDB weigh-ins, API Gateway + Lambda CRUD, and a static web UI on S3/CloudFront. See [`DYNAMODB_SCHEMA.md`](./DYNAMODB_SCHEMA.md).

## Product roadmap

Prioritized future work is tracked in **[`ROADMAP.md`](./ROADMAP.md)**. Items 1–5 are done; next is **#6** (unified CloudFront for web + API), then dev/prod environments, and Android. See **[`AUTH.md`](./AUTH.md)** for sign-in and creating users.

## Notes

This document describes stable scope and architecture. Priorities, status, and implementation choices for upcoming work live in the roadmap.
