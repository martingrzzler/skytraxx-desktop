"use client";

import { useState } from "react";

export default function Test() {
  const [s, setS] = useState<string>("Hello");
  return (
    <div>
      <h1>{s}</h1>
      <button onClick={() => setS("You are")}>Gay</button>
    </div>
  );
}
