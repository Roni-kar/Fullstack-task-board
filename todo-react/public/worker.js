console.log("Service Worker Loaded...");

self.addEventListener("push", e => {
  const data = e.data.json();
  
  // CRITICAL FIX: The "waitUntil" keeps the browser awake 
  // long enough to actually show the notification!
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "https://cdn-icons-png.flaticon.com/512/2693/2693507.png"
    })
  );
});