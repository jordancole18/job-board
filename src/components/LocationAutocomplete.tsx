import { useState, useRef, useEffect } from 'react';
import { MapPin, X } from 'lucide-react';

interface Suggestion {
  display_name: string;
  lat: string;
  lon: string;
}

interface Props {
  onSelect: (lat: number, lng: number, label: string) => void;
  onClear: () => void;
}

export default function LocationAutocomplete({ onSelect, onClear }: Props) {
  const [query, setQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    setSelectedLabel('');
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setSuggestions([]);
      setOpen(false);
      onClear();
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&countrycodes=us&limit=5&addressdetails=1`,
          { headers: { 'User-Agent': 'JobBoardMVP/1.0' } }
        );
        const data: Suggestion[] = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch {
        setSuggestions([]);
      }
      setLoading(false);
    }, 500);
  }

  function handleSelect(s: Suggestion) {
    const parts = s.display_name.split(',');
    const short = parts.slice(0, 2).map((p) => p.trim()).join(', ');
    setQuery(short);
    setSelectedLabel(short);
    setOpen(false);
    setSuggestions([]);
    onSelect(parseFloat(s.lat), parseFloat(s.lon), short);
  }

  function handleClear() {
    setQuery('');
    setSelectedLabel('');
    setSuggestions([]);
    setOpen(false);
    onClear();
  }

  return (
    <div className="autocomplete" ref={containerRef}>
      <div className="autocomplete-input-wrap">
        <MapPin size={16} className="autocomplete-icon" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (suggestions.length > 0 && !selectedLabel) setOpen(true); }}
          placeholder="Enter a city or location..."
          className="autocomplete-input"
        />
        {(query || selectedLabel) && (
          <button className="autocomplete-clear" onClick={handleClear} type="button">
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div className="autocomplete-dropdown">
          {loading ? (
            <div className="autocomplete-loading">Searching...</div>
          ) : (
            suggestions.map((s, i) => {
              const parts = s.display_name.split(',');
              const primary = parts[0].trim();
              const secondary = parts.slice(1, 3).map((p) => p.trim()).join(', ');
              return (
                <button
                  key={i}
                  className="autocomplete-option"
                  onClick={() => handleSelect(s)}
                  type="button"
                >
                  <MapPin size={14} className="autocomplete-option-icon" />
                  <div>
                    <span className="autocomplete-option-primary">{primary}</span>
                    <span className="autocomplete-option-secondary">{secondary}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
