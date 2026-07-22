"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const savedTheme = (localStorage.getItem("theme") as "dark" | "light") || "dark";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="btn-outline"
      style={{
        padding: "0.4rem 0.8rem",
        fontSize: "12px",
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        borderRadius: "20px",
        cursor: "pointer"
      }}
      title={theme === "dark" ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
    >
      {theme === "dark" ? (
        <>
          <Sun size={15} style={{ color: "#ffb700" }} />
          <span>Modo Claro</span>
        </>
      ) : (
        <>
          <Moon size={15} style={{ color: "#7000ff" }} />
          <span>Modo Escuro</span>
        </>
      )}
    </button>
  );
}
