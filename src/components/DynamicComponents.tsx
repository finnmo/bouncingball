'use client';

import dynamic from "next/dynamic";
import { Suspense } from "react";

const LoadingProgress = dynamic(() => import("./LoadingProgress").then(mod => mod.LoadingProgress), {
  loading: () => null,
});

const Header = dynamic(() => import("./Header").then(mod => mod.Header), {
  loading: () => (
    <div className="h-16 bg-white shadow-md animate-pulse" />
  ),
});

export default function DynamicComponents() {
  return (
    <>
      <Suspense fallback={null}>
        <LoadingProgress />
      </Suspense>
      
      <Suspense fallback={<div className="h-16 bg-white shadow-md animate-pulse" />}>
        <Header />
      </Suspense>
    </>
  );
} 