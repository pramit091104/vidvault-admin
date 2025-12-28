import * as fc from 'fast-check';
import { apiService } from './apiService';

// Mock fetch for testing
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('API Endpoint Routing', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Property 1: API Endpoint Routing', () => {
    /**
     * Feature: razorpay-payment-fix, Property 1: API Endpoint Routing
     * Validates: Requirements 1.1, 1.3, 1.4, 4.1, 5.1
     */
    it('should route all payment requests to backend endpoints and never to external Razorpay API', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            amount: fc.integer({ min: 100, max: 100000 }),
            currency: fc.constantFrom('INR', 'USD', 'EUR'),
            receipt: fc.string({ minLength: 1, maxLength: 40 }),
            notes: fc.option(fc.dictionary(fc.string(), fc.string()))
          }),
          async (paymentRequest) => {
            // Mock successful response for order creation
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({ 
                id: 'order_' + Math.random().toString(36).substr(2, 9),
                amount: paymentRequest.amount,
                currency: paymentRequest.currency
              })
            });

            await apiService.createOrder(paymentRequest);

            // Verify the API call was made to the correct backend endpoint
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

            // Verify NO direct calls to Razorpay's external API
            const callUrls = mockFetch.mock.calls.map(call => call[0]);
            const hasDirectRazorpayCall = callUrls.some(url => 
              typeof url === 'string' && url.includes('api.razorpay.com')
            );
            expect(hasDirectRazorpayCall).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: razorpay-payment-fix, Property 1: API Endpoint Routing
     * Validates: Requirements 1.1, 1.3, 1.4, 4.1, 5.1
     */
    it('should route payment verification requests to backend endpoints only', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: fc.string({ minLength: 10, maxLength: 50 }),
            paymentId: fc.string({ minLength: 10, maxLength: 50 }),
            signature: fc.string({ minLength: 20, maxLength: 100 })
          }),
          async (verificationData) => {
            // Mock successful response for payment verification
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({ 
                isValid: Math.random() > 0.5 // Random validation result for testing
              })
            });

            await apiService.verifyPayment(verificationData);

            // Verify the API call was made to the correct backend endpoint
            expect(mockFetch).toHaveBeenCalledWith(
              '/api/razorpay/verify-payment',
              expect.objectContaining({
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(verificationData),
              })
            );

            // Verify NO direct calls to Razorpay's external API
            const callUrls = mockFetch.mock.calls.map(call => call[0]);
            const hasDirectRazorpayCall = callUrls.some(url => 
              typeof url === 'string' && url.includes('api.razorpay.com')
            );
            expect(hasDirectRazorpayCall).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: razorpay-payment-fix, Property 1: API Endpoint Routing
     * Validates: Requirements 1.1, 1.3, 1.4, 4.1, 5.1
     */
    it('should use correct backend endpoint paths for all payment operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            // Order creation scenario
            fc.record({
              operation: fc.constant('createOrder'),
              data: fc.record({
                amount: fc.integer({ min: 100, max: 100000 }),
                currency: fc.constantFrom('INR', 'USD'),
                receipt: fc.string({ minLength: 1, maxLength: 40 })
              })
            }),
            // Payment verification scenario
            fc.record({
              operation: fc.constant('verifyPayment'),
              data: fc.record({
                orderId: fc.string({ minLength: 10, maxLength: 50 }),
                paymentId: fc.string({ minLength: 10, maxLength: 50 }),
                signature: fc.string({ minLength: 20, maxLength: 100 })
              })
            })
          ),
          async (scenario) => {
            // Mock successful response
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => scenario.operation === 'createOrder' 
                ? { id: 'order_123', amount: scenario.data.amount }
                : { isValid: true }
            });

            // Execute the appropriate API call
            if (scenario.operation === 'createOrder') {
              await apiService.createOrder(scenario.data);
            } else {
              await apiService.verifyPayment(scenario.data);
            }

            // Verify the correct endpoint was called
            const expectedEndpoint = scenario.operation === 'createOrder' 
              ? '/api/razorpay/create-order'
              : '/api/razorpay/verify-payment';

            expect(mockFetch).toHaveBeenCalledWith(
              expectedEndpoint,
              expect.objectContaining({
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(scenario.data),
              })
            );

            // Verify the endpoint follows the correct pattern
            const calledUrl = mockFetch.mock.calls[0][0];
            expect(calledUrl).toMatch(/^\/api\/razorpay\/(create-order|verify-payment)$/);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: razorpay-payment-fix, Property 1: API Endpoint Routing
     * Validates: Requirements 1.1, 1.3, 1.4, 4.1, 5.1
     */
    it('should maintain consistent request structure for backend endpoints', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            amount: fc.integer({ min: 100, max: 100000 }),
            currency: fc.constantFrom('INR', 'USD'),
            receipt: fc.string({ minLength: 1, maxLength: 40 }),
            notes: fc.option(fc.dictionary(fc.string(), fc.string()))
          }),
          async (paymentRequest) => {
            // Mock successful response
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({ id: 'order_123' })
            });

            await apiService.createOrder(paymentRequest);

            // Verify request structure consistency
            const [url, options] = mockFetch.mock.calls[0];
            
            // Check URL structure
            expect(url).toBe('/api/razorpay/create-order');
            
            // Check request options structure
            expect(options).toHaveProperty('method', 'POST');
            expect(options).toHaveProperty('headers');
            expect(options.headers).toHaveProperty('Content-Type', 'application/json');
            expect(options).toHaveProperty('body');
            
            // Verify body is properly serialized JSON
            const parsedBody = JSON.parse(options.body);
            expect(parsedBody).toEqual(paymentRequest);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: razorpay-payment-fix, Property 1: API Endpoint Routing
     * Validates: Requirements 1.1, 1.3, 1.4, 4.1, 5.1
     */
    it('should handle backend endpoint errors without falling back to external APIs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            amount: fc.integer({ min: 100, max: 100000 }),
            currency: fc.constantFrom('INR', 'USD'),
            receipt: fc.string({ minLength: 1, maxLength: 40 })
          }),
          async (paymentRequest) => {
            // Mock backend error response
            mockFetch.mockResolvedValueOnce({
              ok: false,
              status: 500,
              json: async () => ({ message: 'Backend error' })
            });

            // Verify that the API service throws an error instead of trying external APIs
            await expect(apiService.createOrder(paymentRequest)).rejects.toThrow();

            // Verify only one call was made (to backend, no fallback to external API)
            expect(mockFetch).toHaveBeenCalledTimes(1);
            
            // Verify the call was to the backend endpoint
            const [url] = mockFetch.mock.calls[0];
            expect(url).toBe('/api/razorpay/create-order');
            
            // Verify NO calls to external Razorpay API
            const callUrls = mockFetch.mock.calls.map(call => call[0]);
            const hasDirectRazorpayCall = callUrls.some(url => 
              typeof url === 'string' && url.includes('api.razorpay.com')
            );
            expect(hasDirectRazorpayCall).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});