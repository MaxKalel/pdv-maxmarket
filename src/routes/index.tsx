import { createFileRoute } from "@tanstack/react-router";
import { Pdv } from "@/components/pdv/Pdv";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PDV · Ponto de Venda" },
      { name: "description", content: "Ponto de venda rápido, operado só pelo teclado." },
      { property: "og:title", content: "PDV · Ponto de Venda" },
      { property: "og:description", content: "Ponto de venda rápido, operado só pelo teclado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pdv,
});
