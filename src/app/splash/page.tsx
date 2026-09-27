import Script from 'next/script';

export const dynamic = 'force-static';

const SPLASH_MS = 1800;

export default function SplashPage() {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html, body {
              margin: 0;
              padding: 0;
              background: #0504AA;
              overflow: hidden;
            }

            .admerce-splash {
              position: fixed;
              inset: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              background:
                radial-gradient(
                  ellipse 120% 60% at 40% 115%,
                  rgba(255, 140, 0, 0.85) 0%,
                  rgba(255, 140, 0, 0.35) 25%,
                  rgba(255, 140, 0, 0) 55%
                ),
                radial-gradient(
                  ellipse 110% 55% at 60% -10%,
                  rgba(80, 60, 255, 0.7) 0%,
                  rgba(80, 60, 255, 0) 60%
                ),
                linear-gradient(
                  180deg,
                  #0504AA 0%,
                  #1A0D80 45%,
                  #3A1160 75%,
                  #4A1540 100%
                );
              overflow: hidden;
              -webkit-font-smoothing: antialiased;
            }

            .admerce-splash-logo {
              width: 200px;
              height: 200px;
              object-fit: contain;
              filter: brightness(0) invert(1);
              animation: admerceSplashIn 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
              will-change: transform, opacity;
            }

            .admerce-splash-wordmark {
              margin: 32px 0 0;
              font-family:
                "Google Sans Flex",
                -apple-system,
                BlinkMacSystemFont,
                "Segoe UI",
                Roboto,
                system-ui,
                sans-serif;
              font-size: 34px;
              font-weight: 800;
              color: #FFFFFF;
              letter-spacing: -0.6px;
              line-height: 1;
              animation: admerceSplashIn 700ms 240ms cubic-bezier(0.22, 1, 0.36, 1) both;
              will-change: transform, opacity;
            }

            @keyframes admerceSplashIn {
              from {
                opacity: 0;
                transform: translateY(10px) scale(0.96);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }

            @media (prefers-reduced-motion: reduce) {
              .admerce-splash-logo,
              .admerce-splash-wordmark {
                animation: none !important;
              }
            }
          `,
        }}
      />

      <main className="admerce-splash">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/admerce_symbol.png"
          alt="Admerce"
          className="admerce-splash-logo"
          // If admerce_symbol.png is a blue pin logo, the CSS filter inverts
          // it to white. If it's already white, remove the filter from the CSS.
        />
        <h1 className="admerce-splash-wordmark">Admerce</h1>
      </main>

      <Script
        id="admerce-splash-redirect"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `setTimeout(function(){window.location.replace('/')},${SPLASH_MS})`,
        }}
      />
    </>
  );
}