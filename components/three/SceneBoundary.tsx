"use client";

import { Component, type ReactNode } from "react";

/** Keeps a failed WebGL init or chunk load from taking the page down; the static fallback stays visible. */
export class SceneBoundary extends Component<{ children: ReactNode; onError?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("[web] 3D scene disabled, showing the static fallback.", err);
    this.props.onError?.();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
