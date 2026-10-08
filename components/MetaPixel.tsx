"use client";

import Script from "next/script";
import { useEffect } from "react";
import { on } from "@/lib/bus";
import { newEventId } from "@/lib/attribution";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Meta Pixel (the dataset in Events Manager). PageView fires on load; Contact
 * fires once when the visitor first touches a form field (form started); and
 * CompleteRegistration fires when the form is accepted — that's the event the
 * "Animation for hire" ad sets optimise on. Lead fires alongside it for
 * reporting. Each one is also sent server-side through the Conversions API
 * with the same eventID, so Meta counts it once.
 */
export function MetaPixel({ id }: { id: string }) {
  useEffect(() => {
    let started = false;
    const offStart = on("form:start", () => {
      if (started) return;
      started = true;
      const eventID = newEventId();
      window.fbq?.("track", "Contact", {}, { eventID });
      // Server twin through the Conversions API; keepalive survives navigation.
      fetch("/api/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "Contact", event_id: eventID }),
        keepalive: true,
      }).catch(() => {});
    });
    // /api/lead already sent the server twins of these two.
    const offSent = on("lead:sent", ({ eventId }) => {
      window.fbq?.("track", "CompleteRegistration", {}, { eventID: eventId });
      window.fbq?.("track", "Lead", {}, { eventID: `${eventId}-lead` });
    });
    return () => {
      offStart();
      offSent();
    };
  }, []);

  if (!id) return null;
  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${id}');fbq('track','PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img height="1" width="1" style={{ display: "none" }} alt="" src={`https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1`} />
      </noscript>
    </>
  );
}
