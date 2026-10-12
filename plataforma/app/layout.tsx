import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Arruda Bombas · Prospecção', description: 'Plataforma comercial Arruda Bombas' };

export default function Layout({children}:{children:React.ReactNode}) { return <html lang="pt-BR"><head><link rel="stylesheet" href="/style.css" /></head><body>{children}</body></html>; }
