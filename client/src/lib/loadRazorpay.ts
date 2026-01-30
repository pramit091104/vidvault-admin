// Load Razorpay checkout script dynamically
export const loadRazorpay = (): Promise<any> => {
  return new Promise((resolve) => {
    // Check if Razorpay is already loaded
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      resolve((window as any).Razorpay);
      return;
    }

    // Create and load the script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    
    script.onload = () => {
      if ((window as any).Razorpay) {
        resolve((window as any).Razorpay);
      } else {
        console.error('Razorpay checkout script loaded but Razorpay object not found');
        resolve(null);
      }
    };
    
    script.onerror = () => {
      console.error('Failed to load Razorpay checkout script');
      resolve(null);
    };
    
    document.body.appendChild(script);
  });
};