import Script from 'next/script';

export default function Home() {
  return <>
    <a className="skip" href="#main">Ir para o conteúdo</a>
    <div id="app"><main id="main" className="boot"><img src="/favicon.svg" width="44" height="44" alt=""/><p>Carregando sua plataforma…</p></main></div>
    <dialog id="dialog" aria-labelledby="dialog-title" />
    <div id="toast" role="status" aria-live="polite" />
    <noscript>Ative o JavaScript para utilizar a plataforma.</noscript>
    <Script src="/app.js" type="module" strategy="afterInteractive" />
  </>;
}
