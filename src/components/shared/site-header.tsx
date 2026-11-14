"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { AtomyModeSwitch } from "@/components/shared/atomy-mode-controls";
import { GalleryLink } from "@/components/shared/gallery-link";
import { GravitationLawLink } from "@/components/shared/gravitation-law-link";
import {
  AtomIcon,
  CloseIcon,
  FallingAppleIcon,
  MenuIcon,
  OrbitIcon,
  SearchIcon,
} from "@/components/shared/icons";
import { FOCUS_RING_CLASS } from "@/components/shared/link-class";
import { SITE_NAME } from "@/lib/page-title";
import {
  FINDER_PATH,
  GALLERY_PATH,
  HOME_PATH,
  LESSON_PATH,
} from "@/lib/routes";

const SECTION_PATHS = [LESSON_PATH, GALLERY_PATH, FINDER_PATH];
const MENU_ID = "menu-principal";

const SECTION_LINK_CLASS = `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-medium whitespace-nowrap text-slate-600 hover:bg-slate-100 hover:text-slate-900 data-current:bg-violet-100 data-current:text-violet-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:data-current:bg-violet-950 dark:data-current:text-violet-100 ${FOCUS_RING_CLASS}`;
const MENU_LINK_CLASS = `flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 data-current:bg-violet-100 data-current:text-violet-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white dark:data-current:bg-violet-950 dark:data-current:text-violet-100 ${FOCUS_RING_CLASS}`;
const ICON_BUTTON_CLASS = `inline-flex size-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 ${FOCUS_RING_CLASS}`;

/**
 * The section the reader is in: the longest section path that the pathname
 * is or starts with, so the finder, inside the gallery, marks only itself.
 */
function currentSection(pathname: string): string | undefined {
  return SECTION_PATHS.filter(
    (section) => pathname === section || pathname.startsWith(`${section}/`),
  ).sort((a, b) => b.length - a.length)[0];
}

/**
 * The link to a section is marked while the reader is in it: `page` on the
 * section's own page, `true` on a page inside it, such as a solution of the
 * gallery.
 */
function sectionLinkProps(
  pathname: string,
  section: string,
  className: string,
): {
  className: string;
  "aria-current"?: "page" | "true";
  "data-current"?: true;
} {
  if (currentSection(pathname) !== section) return { className };
  return {
    className,
    "aria-current": pathname === section ? "page" : "true",
    "data-current": true,
  };
}

/** The three sections, drawn the same in the bar and in the phone's menu. */
function SectionLinks({
  pathname,
  linkClass,
  iconClass,
  onNavigate,
}: {
  pathname: string;
  linkClass: string;
  iconClass: string;
  onNavigate?: () => void;
}): ReactElement {
  const navigate = onNavigate ? { onClick: onNavigate } : {};
  return (
    <>
      <li>
        <GravitationLawLink
          {...sectionLinkProps(pathname, LESSON_PATH, linkClass)}
          {...navigate}
        >
          <FallingAppleIcon className={iconClass} />
          La ley de la gravitación
        </GravitationLawLink>
      </li>
      <li>
        <GalleryLink
          {...sectionLinkProps(pathname, GALLERY_PATH, linkClass)}
          {...navigate}
        >
          <OrbitIcon className={iconClass} />
          Órbitas de tres cuerpos
        </GalleryLink>
      </li>
      <li>
        <Link
          href={FINDER_PATH}
          {...sectionLinkProps(pathname, FINDER_PATH, linkClass)}
          {...navigate}
        >
          <SearchIcon className={iconClass} />
          Busca tu solución
        </Link>
      </li>
    </>
  );
}

/**
 * Below `lg` the sections do not fit beside the brand and the switch: a
 * button opens them in a panel at the right edge, a modal dialog, so the
 * focus stays inside it and Escape closes it.
 */
function MenuDrawer({ pathname }: { pathname: string }): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  // A navigation that does not come from the menu, such as Back, closes it.
  useEffect(() => {
    dialogRef.current?.close();
  }, [pathname]);

  const close = (): void => {
    dialogRef.current?.close();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Menú"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={MENU_ID}
        onClick={() => {
          dialogRef.current?.showModal();
          setOpen(true);
        }}
        className={`${ICON_BUTTON_CLASS} lg:hidden`}
      >
        <MenuIcon className="size-6" />
      </button>
      <dialog
        ref={dialogRef}
        id={MENU_ID}
        aria-label="Menú"
        onClose={() => {
          setOpen(false);
        }}
        // A click on the backdrop reaches the dialog itself.
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-72 max-w-[85vw] bg-white p-0 text-foreground shadow-xl backdrop:bg-slate-950/40 dark:bg-slate-900 lg:hidden"
      >
        <div className="flex h-full flex-col gap-2 p-3">
          <div className="flex justify-end">
            <button
              type="button"
              aria-label="Cerrar el menú"
              onClick={close}
              className={ICON_BUTTON_CLASS}
            >
              <CloseIcon className="size-6" />
            </button>
          </div>
          <ul className="flex flex-col gap-1">
            <SectionLinks
              pathname={pathname}
              linkClass={MENU_LINK_CLASS}
              iconClass="size-5"
              onNavigate={close}
            />
          </ul>
        </div>
      </dialog>
    </>
  );
}

export function SiteHeader(): ReactElement {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 dark:border-slate-800/70 dark:bg-slate-950/90">
      <nav
        aria-label="Principal"
        className="mx-auto flex max-w-6xl items-center justify-between gap-x-4 px-4 py-2 text-sm"
      >
        <Link
          href={HOME_PATH}
          aria-current={pathname === HOME_PATH ? "page" : undefined}
          className={`inline-flex items-center gap-2 rounded-lg py-1 pr-1 text-base font-semibold tracking-tight ${FOCUS_RING_CLASS}`}
        >
          <AtomIcon className="size-6 text-violet-600 dark:text-violet-400" />
          {SITE_NAME}
        </Link>
        <ul className="hidden gap-x-1 lg:flex">
          <SectionLinks
            pathname={pathname}
            linkClass={SECTION_LINK_CLASS}
            iconClass="size-4"
          />
        </ul>
        <div className="flex items-center gap-1">
          <AtomyModeSwitch />
          <MenuDrawer pathname={pathname} />
        </div>
      </nav>
    </header>
  );
}
