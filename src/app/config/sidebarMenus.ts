// src/config/sidebarMenus.ts

export const sidebarMenus = {
  admin: [
    { label: "Dashboard", path: "/modules/admin" },
    { label: "Analytics", path: "/admin" },
    { label: "Home", path: "/" },
    { label: "Discover", path: "/map" },
    { label: "Shop", path: "/products" },
    { label: "News Feed", path: "/feed" },
    { label: "Contact Us", path: "/contactUs" },
  ],
  vet: [
    { label: "Dashboard", path: "/modules/vet" },
    { label: "Home", path: "/" },
    { label: "Discover", path: "/map" },
    { label: "Shop", path: "/products" },
    { label: "News Feed", path: "/feed" },
    { label: "Contact Us", path: "/contactUs" },
  ],
  user: [
    { label: "Dashboard", path: "/modules/user" },
    { label: "Home", path: "/" },
    { label: "Discover", path: "/map" },
    { label: "Shop", path: "/products" },
    { label: "News Feed", path: "/feed" },
    { label: "Book Appointment", path: "/appointments/new" },
    { label: "My Appointments", path: "/userAppointment" },
    { label: "Contact Us", path: "/contactUs" },
    { label: "Delete Account", path: "/delete" },
  ],
};
