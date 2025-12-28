// src/lib/razorpay-utils.ts
export const loadRazorpay = (): Promise<any> => {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      resolve((window as any).Razorpay);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      if ((window as any).Razorpay) {
        resolve((window as any).Razorpay);
      } else {
        console.error('Razorpay SDK failed to load');
        resolve(null);
      }
    };
    script.onerror = () => {
      console.error('Failed to load Razorpay SDK');
      resolve(null);
    };
    document.body.appendChild(script);
  });
};