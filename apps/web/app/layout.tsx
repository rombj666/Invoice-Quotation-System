import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Hour Coffee Quotation & Invoice System",
  description: "Quotation and invoice flow for Hour Coffee"
};

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}

        {GA_MEASUREMENT_ID ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />

            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;

                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}', {
                  send_page_view: true
                });
              `}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}