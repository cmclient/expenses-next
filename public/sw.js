self.addEventListener("push", (event) => {
  let data = {
    title: "Payment Reminder",
    body: "A reminder is due.",
    url: "/reminders",
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = {
        ...data,
        ...parsed,
      };
    } catch {
      // Ignore invalid payloads.
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: { url: data.url || "/reminders" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/reminders";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
