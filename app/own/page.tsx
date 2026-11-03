import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { OwnFlow } from "@/components/own/OwnFlow";

export const metadata: Metadata = {
  title: "Own your memory",
  description: `Move what ${BRAND.name} has learned about your football taste into a Walrus Memory account your own Sui wallet controls. Optional, and reversible.`,
  robots: { index: false },
};

const POINTS = [
  ["You hold the keys", "The account belongs to your wallet. Pocket Pundit only gets a delegate key you add, and you can remove it at any time."],
  ["Nothing to set up again", "Your existing memories are copied across, and your picks carry on as before."],
  ["Checked on Sui", "Before anything moves, the server reads your account on Sui through Tatum and confirms the key is there."],
];

export default function OwnPage() {
  return (
    <div className="shell pt-10 md:pt-16">
      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p className="micro">Optional · needs a Sui wallet</p>
          <h1 className="display-l mt-4">Own your memory.</h1>
          <p className="lede mt-5 max-w-2xl">
            Your taste memory already lives on Walrus, encrypted. This moves it into an account your own wallet controls, so you decide who can read it and for how long. It takes one or two signatures and a network fee of about 0.01 SUI.
          </p>
          <ul className="mt-8 grid gap-4">
            {POINTS.map(([h, b]) => (
              <li key={h} className="card p-5">
                <h2 className="text-lg font-semibold">{h}</h2>
                <p className="mt-1.5 text-[0.95rem] leading-relaxed text-chalk-2">{b}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-5">
          <OwnFlow />
        </div>
      </div>
    </div>
  );
}
