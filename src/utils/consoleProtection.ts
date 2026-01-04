/**
 * Console protection utilities to prevent unauthorized access
 */

export const initConsoleProtection = () => {
  // Clear console periodically
  const clearConsole = () => {
    console.clear();
    console.log(
      '%cSTOP!',
      'color: red; font-size: 50px; font-weight: bold; text-shadow: 3px 3px 0 rgb(217,31,38), 6px 6px 0 rgb(226,91,14), 9px 9px 0 rgb(245,221,8), 12px 12px 0 rgb(5,148,68), 15px 15px 0 rgb(2,135,206), 18px 18px 0 rgb(4,77,145), 21px 21px 0 rgb(42,21,113);'
    );
    console.log(
      '%cThis is a browser feature intended for developers. Video content is protected and unauthorized access is prohibited.',
      'color: red; font-size: 16px; font-weight: bold;'
    );
    console.log(
      '%cIf someone told you to copy-paste something here, it is a scam and will give them access to your account.',
      'color: red; font-size: 14px;'
    );
  };

  // Override console methods
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;
  const originalDebug = console.debug;

  console.log = (...args: any[]) => {
    clearConsole();
    return originalLog.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    clearConsole();
    return originalWarn.apply(console, args);
  };

  console.error = (...args: any[]) => {
    clearConsole();
    return originalError.apply(console, args);
  };

  console.info = (...args: any[]) => {
    clearConsole();
    return originalInfo.apply(console, args);
  };

  console.debug = (...args: any[]) => {
    clearConsole();
    return originalDebug.apply(console, args);
  };

  // Detect developer tools
  let devtools = false;
  const threshold = 160;

  const detectDevTools = () => {
    if (
      window.outerHeight - window.innerHeight > threshold ||
      window.outerWidth - window.innerWidth > threshold
    ) {
      if (!devtools) {
        devtools = true;
        clearConsole();
        // Blur the page content when dev tools are detected
        document.body.style.filter = 'blur(5px)';
        document.body.style.pointerEvents = 'none';
        
        // Show warning overlay
        const overlay = document.createElement('div');
        overlay.id = 'dev-tools-warning';
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.9);
          color: white;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 9999;
          font-family: Arial, sans-serif;
        `;
        overlay.innerHTML = `
          <h1 style="font-size: 48px; margin-bottom: 20px; color: #ff0000;">⚠️ ACCESS DENIED</h1>
          <p style="font-size: 24px; margin-bottom: 10px;">Developer tools detected</p>
          <p style="font-size: 18px; opacity: 0.8;">This content is protected. Please close developer tools to continue.</p>
        `;
        document.body.appendChild(overlay);
      }
    } else {
      if (devtools) {
        devtools = false;
        document.body.style.filter = '';
        document.body.style.pointerEvents = '';
        const overlay = document.getElementById('dev-tools-warning');
        if (overlay) {
          overlay.remove();
        }
      }
    }
  };

  // Check for dev tools every 100ms
  setInterval(detectDevTools, 100);

  // Disable common keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+S
    if (
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
      (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) ||
      (e.ctrlKey && (e.key === 'U' || e.key === 'u')) ||
      (e.ctrlKey && (e.key === 'S' || e.key === 's')) ||
      (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c'))
    ) {
      e.preventDefault();
      clearConsole();
      return false;
    }
  });

  // Disable right-click context menu
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });

  // Disable text selection
  document.addEventListener('selectstart', (e) => {
    e.preventDefault();
    return false;
  });

  // Disable drag and drop
  document.addEventListener('dragstart', (e) => {
    e.preventDefault();
    return false;
  });

  // Initial console clear
  clearConsole();
};

export const disableConsoleProtection = () => {
  // Remove the warning overlay if it exists
  const overlay = document.getElementById('dev-tools-warning');
  if (overlay) {
    overlay.remove();
  }
  
  // Reset body styles
  document.body.style.filter = '';
  document.body.style.pointerEvents = '';
};