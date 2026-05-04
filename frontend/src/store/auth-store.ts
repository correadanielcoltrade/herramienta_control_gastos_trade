const TOKEN_KEY = "mkp_serial_control_jwt";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export const authStore = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
    notify();
  },
  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    notify();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

window.addEventListener("storage", (event) => {
  if (event.key === TOKEN_KEY) {
    notify();
  }
});
