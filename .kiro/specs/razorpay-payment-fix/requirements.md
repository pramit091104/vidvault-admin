# Requirements Document

## Introduction

Fix the Razorpay payment integration CORS issue where the frontend is incorrectly making direct API calls to Razorpay's servers instead of using the backend proxy endpoints. The system should properly route payment requests through the backend API to avoid CORS restrictions and maintain security.

## Glossary

- **Payment_Gateway**: The Razorpay service for processing payments
- **Backend_API**: The server-side API endpoints that proxy requests to Razorpay
- **Frontend_Client**: The React application making payment requests
- **CORS**: Cross-Origin Resource Sharing policy that blocks direct browser requests to external APIs
- **Payment_Flow**: The complete process from order creation to payment verification

## Requirements

### Requirement 1: Backend API Routing

**User Story:** As a developer, I want payment requests to be properly routed through backend APIs, so that CORS restrictions are avoided and security is maintained.

#### Acceptance Criteria

1. WHEN the Frontend_Client creates a payment order, THE Backend_API SHALL receive the request at `/api/razorpay/create-order`
2. WHEN the Backend_API receives an order creation request, THE Backend_API SHALL proxy it to Razorpay's API using server-side credentials
3. WHEN the Frontend_Client verifies a payment, THE Backend_API SHALL receive the request at `/api/razorpay/verify-payment`
4. THE Frontend_Client SHALL NOT make direct requests to `api.razorpay.com`

### Requirement 2: API Service Configuration

**User Story:** As a system administrator, I want the API service to use correct endpoint URLs, so that requests are properly routed to the backend.

#### Acceptance Criteria

1. WHEN the API service is initialized, THE API_Service SHALL use the correct base URL for the current environment
2. WHEN running in development, THE API_Service SHALL use `http://localhost:3000` as the base URL
3. WHEN running in production, THE API_Service SHALL use relative URLs to work with the deployed backend
4. THE API_Service SHALL include proper error handling for network failures

### Requirement 3: Environment Configuration

**User Story:** As a developer, I want environment variables to be properly configured, so that the payment system works in all deployment environments.

#### Acceptance Criteria

1. WHEN the application starts, THE System SHALL load Razorpay credentials from environment variables
2. THE Backend_API SHALL use `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` for server-side operations
3. THE Frontend_Client SHALL use `VITE_RAZORPAY_KEY_ID` for client-side Razorpay checkout initialization
4. IF environment variables are missing, THEN THE System SHALL provide clear error messages

### Requirement 4: Payment Order Creation

**User Story:** As a user, I want to create payment orders through the backend API, so that payments can be processed securely.

#### Acceptance Criteria

1. WHEN a payment order is requested, THE Frontend_Client SHALL send the request to `/api/razorpay/create-order`
2. WHEN the Backend_API receives the order request, THE Backend_API SHALL validate the request parameters
3. WHEN the order is created successfully, THE Backend_API SHALL return the Razorpay order object
4. IF the order creation fails, THEN THE Backend_API SHALL return a descriptive error message

### Requirement 5: Payment Verification

**User Story:** As a user, I want payment verification to be handled securely on the backend, so that payment integrity is maintained.

#### Acceptance Criteria

1. WHEN a payment is completed, THE Frontend_Client SHALL send verification data to `/api/razorpay/verify-payment`
2. WHEN the Backend_API receives verification data, THE Backend_API SHALL validate the payment signature using the secret key
3. WHEN verification succeeds, THE Backend_API SHALL return `{isValid: true}`
4. WHEN verification fails, THE Backend_API SHALL return `{isValid: false}`