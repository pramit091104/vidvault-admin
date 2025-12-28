// Integration tests for the complete payment flow
// Tests end-to-end payment processing and verifies CORS issues are resolved

import * as fc from 'fast-check';
import { apiService, PaymentRequest, PaymentVerification } from '../services/apiService';

// Mock the environment configuration for testing
jest.mock('../config/environment', () => ({
  getApiBaseUrl: () => '',
  handleNetworkError: (error: Error) => error,
  validateApiResponse: (response: any) => {
    if (response === null || response === undefined) {
      throw new Error('Invalid response: Response is null or undefined');
    }
    if (typeof response !== 'object' || Array.isArray(response)) {
      throw new Error('Invalid response: Response must be an object');
    }
  }
}));

// Mock fetch for integration testing
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock console methods to avoid noise in tests
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

describe('Payment Flow Integration Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // Suppress console output during tests
    console.error = jest.fn();
    console.log = jest.fn();
  });

  afterEach(() => {
    // Restore console methods
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
    // Clear all mocks after each test
    jest.clearAllMocks();
  });

  describe('Complete Payment Flow', () => {
    /**
     * Integration test for complete payment flow from order creation to verification
     * Validates: All requirements - ensures the complete payment process works end-to-end
     */
    it('should complete the full payment flow from order creation to verification', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            amount: fc.integer({ min: 100, max: 100000 }),
            currency: fc.constantFrom('INR', 'USD', 'EUR'),
            receipt: fc.string({ minLength: 5, maxLength: 40 }),
            notes: fc.option(fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string({ minLength: 1, maxLength: 50 }))),
            clientName: fc.string({ minLength: 2, maxLength: 50 }),
            paymentType: fc.constantFrom('pre', 'post', 'final')
          }),
          async (testData) => {
            // Step 1: Create payment order
            const orderResponse = {
              id: `order_${Math.random().toString(36).substr(2, 9)}`,
              amount: testData.amount,
              currency: testData.currency,
              receipt: testData.receipt,
              notes: testData.notes,
              status: 'created'
            };

            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => orderResponse
            });

            const paymentRequest: PaymentRequest = {
              amount: testData.amount,
              currency: testData.currency,
              receipt: testData.receipt,
              notes: {
                ...testData.notes,
                client_name: testData.clientName,
                payment_type: testData.paymentType
              }
            };

            const order = await apiService.createOrder(paymentRequest);

            // Verify order creation API call
            expect(mockFetch).toHaveBeenCalledWith(
              '/api/razorpay/create-order',
              expect.objectContaining({
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(paymentRequest),
              })
            );

            // Verify order response structure
            expect(order).toHaveProperty('id');
            expect(order).toHaveProperty('amount', testData.amount);
            expect(order).toHaveProperty('currency', testData.currency);
            expect(order).toHaveProperty('receipt', testData.receipt);

            // Step 2: Simulate payment completion and verification
            const paymentId = `pay_${Math.random().toString(36).substr(2, 9)}`;
            const signature = `signature_${Math.random().toString(36).substr(2, 20)}`;

            const verificationResponse = {
              isValid: true
            };

            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => verificationResponse
            });

            const verification: PaymentVerification = {
              orderId: order.id,
              paymentId: paymentId,
              signature: signature
            };

            const verificationResult = await apiService.verifyPayment(verification);

            // Verify payment verification API call
            expect(mockFetch).toHaveBeenCalledWith(
              '/api/razorpay/verify-payment',
              expect.objectContaining({
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(verification),
              })
            );

            // Verify verification response
            expect(verificationResult).toHaveProperty('isValid', true);

            // Verify that all API calls went through backend endpoints (no direct Razorpay calls)
            const allCalls = mockFetch.mock.calls;
            allCalls.forEach(call => {
              const url = call[0] as string;
              expect(url).not.toContain('api.razorpay.com');
              expect(url).not.toContain('razorpay.com');
              expect(url).toMatch(/\/api\/razorpay\/(create-order|verify-payment)$/);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Integration test for CORS resolution verification
     * Validates: Requirements 1.1, 1.4 - ensures no direct calls to external Razorpay API
     */
    it('should route all payment requests through backend endpoints to avoid CORS', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            amount: fc.integer({ min: 100, max: 50000 }),
            currency: fc.constantFrom('INR', 'USD'),
            receipt: fc.string({ minLength: 1, maxLength: 30 })
          }),
          async (orderData) => {
            // Clear mock before each property test iteration
            mockFetch.mockClear();
            
            // Mock successful responses for both endpoints
            mockFetch
              .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'order_123', ...orderData })
              })
              .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ isValid: true })
              });

            // Test order creation
            await apiService.createOrder(orderData);

            // Test payment verification
            await apiService.verifyPayment({
              orderId: 'order_123',
              paymentId: 'pay_123',
              signature: 'sig_123'
            });

            // Verify all calls are to backend endpoints
            const allCalls = mockFetch.mock.calls;
            expect(allCalls).toHaveLength(2);

            // Check order creation call
            expect(allCalls[0][0]).toMatch(/\/api\/razorpay\/create-order$/);
            expect(allCalls[0][0]).not.toContain('razorpay.com');

            // Check verification call
            expect(allCalls[1][0]).toMatch(/\/api\/razorpay\/verify-payment$/);
            expect(allCalls[1][0]).not.toContain('razorpay.com');

            // Verify proper HTTP methods
            expect(allCalls[0][1]).toHaveProperty('method', 'POST');
            expect(allCalls[1][1]).toHaveProperty('method', 'POST');

            // Verify proper headers
            expect(allCalls[0][1]).toHaveProperty('headers', expect.objectContaining({
              'Content-Type': 'application/json'
            }));
            expect(allCalls[1][1]).toHaveProperty('headers', expect.objectContaining({
              'Content-Type': 'application/json'
            }));
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Integration test for error handling throughout the payment flow
     * Validates: Requirements 2.4, 3.4, 4.4 - ensures proper error handling
     */
    it('should handle errors gracefully throughout the payment flow', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            errorType: fc.constantFrom('network', 'server', 'validation'),
            amount: fc.integer({ min: 100, max: 10000 }),
            currency: fc.constantFrom('INR', 'USD'),
            receipt: fc.string({ minLength: 1, maxLength: 20 })
          }),
          async (testData) => {
            const paymentRequest: PaymentRequest = {
              amount: testData.amount,
              currency: testData.currency,
              receipt: testData.receipt
            };

            switch (testData.errorType) {
              case 'network':
                // Simulate network error
                mockFetch.mockRejectedValueOnce(new Error('Network error'));
                await expect(apiService.createOrder(paymentRequest))
                  .rejects.toThrow('Network error');
                break;

              case 'server':
                // Simulate server error
                mockFetch.mockResolvedValueOnce({
                  ok: false,
                  json: async () => ({ message: 'Server error' })
                });
                await expect(apiService.createOrder(paymentRequest))
                  .rejects.toThrow('Server error');
                break;

              case 'validation':
                // Simulate validation error
                mockFetch.mockResolvedValueOnce({
                  ok: false,
                  json: async () => ({ message: 'Invalid amount' })
                });
                await expect(apiService.createOrder(paymentRequest))
                  .rejects.toThrow('Invalid amount');
                break;
            }

            // Verify that errors don't cause direct calls to Razorpay
            const allCalls = mockFetch.mock.calls;
            allCalls.forEach(call => {
              const url = call[0] as string;
              expect(url).not.toContain('razorpay.com');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Integration test for environment-specific API routing
     * Validates: Requirements 2.1, 2.2, 2.3 - ensures correct base URLs for different environments
     */
    it('should use correct API base URLs based on environment configuration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            amount: fc.integer({ min: 100, max: 5000 }),
            currency: fc.constantFrom('INR'),
            receipt: fc.string({ minLength: 1, maxLength: 15 })
          }),
          async (orderData) => {
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({ id: 'order_test', ...orderData })
            });

            await apiService.createOrder(orderData);

            const callUrl = mockFetch.mock.calls[0][0] as string;
            
            // In test environment, should use relative URL
            expect(callUrl).toBe('/api/razorpay/create-order');

            // Ensure no direct external API calls
            expect(callUrl).not.toContain('api.razorpay.com');
            expect(callUrl).not.toContain('checkout.razorpay.com');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Integration test for payment data integrity throughout the flow
     * Validates: Requirements 4.1, 4.2, 4.3, 5.1, 5.2 - ensures data integrity
     */
    it('should maintain payment data integrity throughout the complete flow', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            amount: fc.integer({ min: 100, max: 25000 }),
            currency: fc.constantFrom('INR', 'USD'),
            receipt: fc.string({ minLength: 3, maxLength: 25 }),
            clientId: fc.string({ minLength: 5, maxLength: 20 }),
            paymentType: fc.constantFrom('pre', 'post', 'final')
          }),
          async (testData) => {
            // Clear mock before each property test iteration
            mockFetch.mockClear();
            
            // Create order with specific data
            const orderResponse = {
              id: `order_${testData.receipt}`,
              amount: testData.amount,
              currency: testData.currency,
              receipt: testData.receipt,
              notes: {
                client_id: testData.clientId,
                payment_type: testData.paymentType
              },
              status: 'created'
            };

            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => orderResponse
            });

            const paymentRequest: PaymentRequest = {
              amount: testData.amount,
              currency: testData.currency,
              receipt: testData.receipt,
              notes: {
                client_id: testData.clientId,
                payment_type: testData.paymentType
              }
            };

            const order = await apiService.createOrder(paymentRequest);

            // Verify order data integrity
            expect(order.amount).toBe(testData.amount);
            expect(order.currency).toBe(testData.currency);
            expect(order.receipt).toBe(testData.receipt);
            expect(order.notes?.client_id).toBe(testData.clientId);
            expect(order.notes?.payment_type).toBe(testData.paymentType);

            // Verify the request payload sent to backend
            const orderCallPayload = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(orderCallPayload.amount).toBe(testData.amount);
            expect(orderCallPayload.currency).toBe(testData.currency);
            expect(orderCallPayload.receipt).toBe(testData.receipt);
            expect(orderCallPayload.notes.client_id).toBe(testData.clientId);
            expect(orderCallPayload.notes.payment_type).toBe(testData.paymentType);

            // Test verification with the same order data
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({ isValid: true })
            });

            const verification: PaymentVerification = {
              orderId: order.id,
              paymentId: `pay_${testData.receipt}`,
              signature: `sig_${testData.receipt}`
            };

            await apiService.verifyPayment(verification);

            // Verify verification data integrity
            const verificationCallPayload = JSON.parse(mockFetch.mock.calls[1][1].body);
            expect(verificationCallPayload.orderId).toBe(order.id);
            expect(verificationCallPayload.paymentId).toBe(`pay_${testData.receipt}`);
            expect(verificationCallPayload.signature).toBe(`sig_${testData.receipt}`);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Integration test for concurrent payment processing
     * Validates: All requirements - ensures system handles multiple concurrent payments
     */
    it('should handle multiple concurrent payment requests correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              amount: fc.integer({ min: 100, max: 10000 }),
              currency: fc.constantFrom('INR'),
              receipt: fc.string({ minLength: 5, maxLength: 20 })
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (paymentRequests) => {
            // Clear mock before each property test iteration
            mockFetch.mockClear();
            
            // Mock responses for all requests
            paymentRequests.forEach((_, index) => {
              mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                  id: `order_${index}`,
                  amount: paymentRequests[index].amount,
                  currency: paymentRequests[index].currency,
                  receipt: paymentRequests[index].receipt
                })
              });
            });

            // Process all payments concurrently
            const orderPromises = paymentRequests.map(request => 
              apiService.createOrder(request)
            );

            const orders = await Promise.all(orderPromises);

            // Verify all orders were created successfully
            expect(orders).toHaveLength(paymentRequests.length);
            
            orders.forEach((order, index) => {
              expect(order.amount).toBe(paymentRequests[index].amount);
              expect(order.currency).toBe(paymentRequests[index].currency);
              expect(order.receipt).toBe(paymentRequests[index].receipt);
            });

            // Verify all calls went to backend endpoints
            expect(mockFetch).toHaveBeenCalledTimes(paymentRequests.length);
            mockFetch.mock.calls.forEach(call => {
              const url = call[0] as string;
              expect(url).toMatch(/\/api\/razorpay\/create-order$/);
              expect(url).not.toContain('razorpay.com');
            });
          }
        ),
        { numRuns: 50 } // Reduced runs for concurrent test
      );
    });
  });
});