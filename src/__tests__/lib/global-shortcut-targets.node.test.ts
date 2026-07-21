import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { describe, expect, it } from "vitest";
import {
  isGlobalShortcutNativeActivationTarget,
  isGlobalShortcutTextEditingTarget,
  isModalBlockedMenuAction,
  shouldIgnoreGlobalShortcutKeyboardEvent,
} from "@/lib/keyboard/global-shortcut-targets";

setupBrowserTestDom();

function createElement(markup: string): Element {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = markup;
  const element = wrapper.firstElementChild;
  if (element === null) {
    throw new Error(`Expected markup to create an element: ${markup}`);
  }
  return element;
}

describe("global shortcut targets", () => {
  it.each([
    ["input", "<input />"],
    ["textarea", "<textarea></textarea>"],
    ["select", "<select></select>"],
    ["contenteditable true", '<div contenteditable="true"></div>'],
    ["contenteditable plaintext-only", '<div contenteditable="plaintext-only"></div>'],
    ["ARIA textbox", '<div role="textbox"></div>'],
    ["ARIA searchbox", '<div role="searchbox"></div>'],
    ["disabled input", "<input disabled />"],
    ["nested ARIA textbox", '<div role="textbox"><span></span></div>'],
    ["nested contenteditable", '<div contenteditable="true"><span></span></div>'],
  ] as const)("treats %s as a text editing target", (_label, markup) => {
    const element = createElement(markup);
    expect(isGlobalShortcutTextEditingTarget(element.querySelector("span") ?? element)).toBe(true);
  });

  it.each([
    ["plain div", "<div></div>"],
    ["contenteditable false", '<div contenteditable="false"></div>'],
    ["button", "<button></button>"],
  ] as const)("does not treat %s as a text editing target", (_label, markup) => {
    expect(isGlobalShortcutTextEditingTarget(createElement(markup))).toBe(false);
  });

  it.each([
    ["IME composition", { key: "m", isComposing: true }],
    ["Alt/Option modified key", { key: "m", altKey: true }],
    ["dead key", { key: "Dead" }],
    ["unidentified key", { key: "Unidentified" }],
    ["process key", { key: "Process" }],
  ] as const)("ignores %s before resolving global shortcuts", (_label, event) => {
    expect(shouldIgnoreGlobalShortcutKeyboardEvent(event)).toBe(true);
  });

  it.each([
    ["button", "<button></button>"],
    ["anchor with href", '<a href="https://example.test">link</a>'],
    ["ARIA button role", '<div role="button"></div>'],
    ["ARIA link role", '<div role="link"></div>'],
    ["summary", "<summary></summary>"],
    ["nested inside a button", "<button><span></span></button>"],
  ] as const)("treats %s as a native-activation target", (_label, markup) => {
    const element = createElement(markup);
    expect(isGlobalShortcutNativeActivationTarget(element.querySelector("span") ?? element)).toBe(true);
  });

  it.each([
    ["plain div", "<div></div>"],
    ["input", "<input />"],
    ["anchor without href", "<a>no href</a>"],
  ] as const)("does not treat %s as a native-activation target", (_label, markup) => {
    expect(isGlobalShortcutNativeActivationTarget(createElement(markup))).toBe(false);
  });

  it("keeps native menu reader actions modal-blocked while allowing app-level actions", () => {
    expect(isModalBlockedMenuAction("next-article")).toBe(true);
    expect(isModalBlockedMenuAction("toggle-read")).toBe(true);
    expect(isModalBlockedMenuAction("open-command-palette")).toBe(true);
    expect(isModalBlockedMenuAction("sync-all")).toBe(false);
    expect(isModalBlockedMenuAction("check-for-updates")).toBe(false);
    expect(isModalBlockedMenuAction("toggle-fullscreen")).toBe(false);
  });
});
