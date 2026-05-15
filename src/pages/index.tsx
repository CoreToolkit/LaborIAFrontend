import Head from "next/head";
import type { GetServerSideProps } from "next";

export default function Home() {
  return (
    <>
      <Head>
        <title>LaborIA - Potencia tu carrera con IA</title>
        <meta name="description" content="Plataforma de preparación profesional con Inteligencia Artificial" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-screen bg-slate-50" />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: "/login",
      permanent: false,
    },
  };
};
