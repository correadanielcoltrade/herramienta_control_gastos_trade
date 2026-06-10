import { Check, ChevronDown, Search } from "lucide-react";
import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";

export type SearchableSelectOption = {
  value: string;
  label: string;
};

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Clases para el boton/disparador, para reutilizar el estilo de cada pagina. */
  className?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  ariaLabel?: string;
  emptyMessage?: string;
}

/** Marcas diacriticas combinantes (acentos): rango Unicode U+0300 a U+036F. */
const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

/** Normaliza texto para buscar sin distinguir mayusculas ni acentos. */
function normalizeText(value: string) {
  return value.normalize("NFD").replace(DIACRITICS, "").toLowerCase().trim();
}

/**
 * Lista desplegable con buscador integrado. Permite escribir para filtrar las
 * opciones por etiqueta (ignorando acentos y mayusculas), navegar con el teclado
 * y seleccionar. Mantiene la misma API que un <select> controlado: value/onChange
 * trabajan con strings (usa "" para la opcion "todos").
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  disabled = false,
  className = "",
  placeholder = "Selecciona una opcion",
  searchPlaceholder = "Buscar...",
  ariaLabel,
  emptyMessage = "Sin coincidencias",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const listboxId = useId();

  const selectedOption = options.find((option) => option.value === value);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
      return options;
    }
    return options.filter((option) => normalizeText(option.label).includes(normalizedQuery));
  }, [options, query]);

  // Cerrar al hacer clic fuera del componente.
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Enfocar el buscador al abrir.
  useEffect(() => {
    if (!open) {
      return;
    }

    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Mantener visible la opcion resaltada.
  useEffect(() => {
    if (!open || !listRef.current) {
      return;
    }

    const node = listRef.current.querySelectorAll("[data-option]")[highlight] as HTMLElement | undefined;
    node?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  function toggleOpen() {
    if (disabled) {
      return;
    }

    setOpen((current) => {
      const next = !current;
      if (next) {
        setQuery("");
        const selectedIndex = options.findIndex((option) => option.value === value);
        setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
      }
      return next;
    });
  }

  function commit(optionValue: string) {
    onChange(optionValue);
    setOpen(false);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) => Math.min(current + 1, filteredOptions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filteredOptions[highlight];
      if (option) {
        commit(option.value);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  const displayLabel = selectedOption?.label ?? placeholder;
  const isPlaceholder = !selectedOption;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={toggleOpen}
        className={`flex items-center justify-between gap-2 text-left ${className} ${
          disabled ? "cursor-not-allowed opacity-60" : ""
        }`}
      >
        <span className={`truncate ${isPlaceholder ? "text-slate-400" : "text-slate-700"}`}>{displayLabel}</span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search size={15} className="shrink-0 text-slate-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlight(0);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
          <ul ref={listRef} role="listbox" id={listboxId} className="max-h-60 overflow-y-auto py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => {
                const isSelected = option.value === value;
                const isHighlighted = index === highlight;
                return (
                  <li key={option.value || "__all__"} role="option" aria-selected={isSelected} data-option>
                    <button
                      type="button"
                      onClick={() => commit(option.value)}
                      onMouseEnter={() => setHighlight(index)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition ${
                        isHighlighted ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="truncate">{option.label}</span>
                      {isSelected ? <Check size={15} className="shrink-0 text-brand-600" /> : null}
                    </button>
                  </li>
                );
              })
            ) : (
              <li className="px-3 py-3 text-center text-sm text-slate-400">{emptyMessage}</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
