"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function OpeningIntro() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(false);
    }, 2600);

    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="opening-intro"
      aria-label="S.V. Bakery"
    >
      <div className="opening-intro__card">
        <Image
          src="/images/hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="opening-intro__image"
        />

        <div className="opening-intro__overlay" />

        <div className="opening-intro__steam opening-intro__steam--one" />
        <div className="opening-intro__steam opening-intro__steam--two" />
        <div className="opening-intro__steam opening-intro__steam--three" />

        <div className="opening-intro__content">
          <p className="opening-intro__eyebrow">
            Fresh from the oven
          </p>

          <h1>
            S.V. BAKERY
          </h1>

          <p>
            Freshly Baked. Made With Love.
          </p>
        </div>
      </div>
    </div>
  );
}
