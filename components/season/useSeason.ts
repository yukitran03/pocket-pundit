"use client";

import { useSyncExternalStore } from "react";
import { daysToBoxingDay, inWinterNights } from "@/lib/client/season";

export interface SeasonState {
  /** Inside 1 Nov to 6 Jan (or forced with ?season=winter). */
  season: boolean;
  daysToBoxingDay: number;
  /** The visitor's own switch (footer "Snow on/off"), remembered in localStorage. */
  pref: "on" | "off";
  reduced: boolean;
  /** Snow actually shows: in season, switched on, and motion allowed. */
  snow: boolean;
}

const KEY = "pp-snow";
const SERVER: SeasonState = { season: false, daysToBoxingDay: 0, pref: "on", reduced: true, snow: false };
let state: SeasonState | null = null;
/** This visit's choice; wins over storage, so the switch works even when storage is blocked. */
let memPref: "on" | "off" | null = null;
const listeners = new Set<() => void>();

function compute(): SeasonState {
  const now = new Date();
  let season = inWinterNights(now);
  try {
    const force = new URLSearchParams(window.location.search).get("season");
    if (force === "winter") season = true;
    if (force === "off") season = false;
  } catch {
    /* no URL */
  }
  let pref: "on" | "off" = memPref ?? "on";
  if (!memPref) {
    try {
      pref = window.localStorage.getItem(KEY) === "off" ? "off" : "on";
    } catch {
      /* storage blocked: default on */
    }
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return { season, daysToBoxingDay: daysToBoxingDay(now), pref, reduced, snow: season && pref === "on" && !reduced };
}

function emit() {
  state = compute();
  listeners.forEach((l) => l());
}

/** Mirror the state on <html> so CSS can add the seasonal accents (called from an effect, never in render). */
export function applySeasonToDocument(s: SeasonState) {
  const root = document.documentElement;
  if (s.season) root.dataset.season = "winter";
  else delete root.dataset.season;
  root.dataset.snow = s.snow ? "on" : "off";
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (listeners.size === 1) {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", emit);
    window.addEventListener("storage", emit);
    (subscribe as { off?: () => void }).off = () => {
      mq.removeEventListener("change", emit);
      window.removeEventListener("storage", emit);
    };
  }
  return () => {
    listeners.delete(l);
    if (!listeners.size) (subscribe as { off?: () => void }).off?.();
  };
}

function getSnapshot() {
  if (!state) state = compute();
  return state;
}

export function useSeason(): SeasonState {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER);
}

export function setSnow(on: boolean) {
  memPref = on ? "on" : "off";
  try {
    window.localStorage.setItem(KEY, memPref);
  } catch {
    /* storage blocked: the in-memory choice still applies for this visit */
  }
  emit();
}
