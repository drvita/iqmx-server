import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/login", "/privacidad", "/kiosk"],
        disallow: [
          "/dashboard",
          "/empleados",
          "/horarios",
          "/sucursales",
          "/dispositivos",
          "/asistentes",
          "/configuracion",
          "/marca",
          "/lab",
          "/api/",
        ],
      },
    ],
    sitemap: "https://checador.iqissmexico.com/sitemap.xml",
  };
}
