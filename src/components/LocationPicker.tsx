import { useState, useMemo, useRef, useEffect } from "react";
import { useDistrictCoordinates } from "@/hooks/useIncidents";
import { normalizeProvince, normalizeDistrict } from "@/lib/normalize";
import { getTehsilsForDistrict } from "@/lib/tehsils";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronDown, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface LocationPickerProps {
  country?: string;
  province: string;
  district: string;
  tehsil?: string;
  onProvinceChange: (v: string) => void;
  onDistrictChange: (v: string) => void;
  onTehsilChange?: (v: string) => void;
  onCountryChange?: (v: string) => void;
  showCountry?: boolean;
  showTehsil?: boolean;
  size?: "sm" | "md";
  className?: string;
}

function SearchableSelect({
  value,
  options,
  onChange,
  placeholder,
  size = "sm",
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSearch("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, search]);

  const h = size === "sm" ? "h-7" : "h-8";

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            `${h} w-full justify-between text-xs font-mono bg-secondary border-border px-2`,
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <div className="flex items-center gap-0.5 shrink-0">
            {value && (
              <span
                role="button"
                className="rounded-sm hover:bg-muted p-0.5"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onChange("");
                }}
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-[9999]" align="start" side="bottom" avoidCollisions>
        <div className="flex items-center border-b border-border px-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${placeholder.toLowerCase()}...`}
            className="flex-1 bg-transparent border-0 outline-none text-xs font-mono py-2 px-2 placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground font-mono p-3 text-center">No results</p>
          ) : (
            filtered.map((opt) => (
              <button
                type="button"
                key={opt}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt);
                  setOpen(false);
                }}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left text-xs font-mono px-3 py-1.5 hover:bg-accent hover:text-accent-foreground transition-colors",
                  value === opt && "bg-primary/10 text-primary font-semibold"
                )}
              >
                {opt}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function LocationPicker({
  country,
  province,
  district,
  tehsil,
  onProvinceChange,
  onDistrictChange,
  onTehsilChange,
  onCountryChange,
  showCountry = false,
  showTehsil = true,
  size = "sm",
  className,
}: LocationPickerProps) {
  const { data: coords } = useDistrictCoordinates();

  const countries = useMemo(() => {
    if (!coords) return ["Pakistan"];
    return [...new Set(coords.filter((c) => c.country === "Pakistan").map((c) => c.country))].sort();
  }, [coords]);

  const provinces = useMemo(() => {
    if (!coords) return [];
    const filtered = coords.filter((c) => c.country === "Pakistan");
    const byCountry = country ? filtered.filter((c) => c.country === country) : filtered;
    return [...new Set(byCountry.map((c) => normalizeProvince(c.province)))].filter((p) => p !== "Unknown").sort().concat(["Unknown"]);
  }, [coords, country]);

  const districts = useMemo(() => {
    if (!coords || !province) return [];
    const normProv = normalizeProvince(province);
    if (normalizeProvince(province) === "Unknown") {
      return ["Unknown"];
    }
    const dbDistricts = [
      ...new Set(
        coords
          .filter((c) => normalizeProvince(c.province) === normProv)
          .map((c) => c.district)
          .map((d) => normalizeDistrict(d))
          .filter(Boolean) as string[]
      ),
    ];
    // Add "Waziristan" as a special option for KP when not already present
    if (normProv === "Khyber Pakhtunkhwa" && !dbDistricts.includes("Waziristan")) {
      dbDistricts.push("Waziristan");
    }
    return dbDistricts.sort();
  }, [coords, province]);

  const tehsilOptions = useMemo(() => {
    return getTehsilsForDistrict(district);
  }, [district]);

  const handleProvinceChange = (v: string) => {
    onProvinceChange(v);
  };

  const handleCountryChange = (v: string) => {
    onCountryChange?.(v);
  };

  const isUnknown = normalizeProvince(province) === "Unknown";

  return (
    <div className={cn("grid grid-cols-2 lg:grid-cols-3 gap-2", className)}>
      {showCountry && (
        <div className="space-y-1">
          <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Country</label>
          <SearchableSelect
            value={country || ""}
            options={countries}
            onChange={handleCountryChange}
            placeholder="Select country"
            size={size}
          />
        </div>
      )}
      <div className="space-y-1">
        <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Province</label>
        <SearchableSelect
          value={province}
          options={provinces}
          onChange={handleProvinceChange}
          placeholder="Select province"
          size={size}
        />
      </div>
      {!isUnknown && (
        <div className="space-y-1">
          <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">District</label>
          <SearchableSelect
            value={district}
            options={districts}
            onChange={(v) => {
              onDistrictChange(v);
            }}
            placeholder={province ? "Select district" : "Select province first"}
            size={size}
          />
        </div>
      )}
      {showTehsil && !isUnknown && (
        <div className="space-y-1">
          <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Tehsil</label>
          {tehsilOptions.length > 0 ? (
            <SearchableSelect
              value={tehsil || ""}
              options={tehsilOptions}
              onChange={(v) => onTehsilChange?.(v)}
              placeholder={district ? "Select tehsil" : "Select district first"}
              size={size}
            />
          ) : (
            <Input
              value={tehsil || ""}
              onChange={(e) => onTehsilChange?.(e.target.value)}
              className={cn(size === "sm" ? "h-7" : "h-8", "text-xs font-mono bg-secondary border-border")}
              placeholder={district ? "Type tehsil" : "Select district first"}
            />
          )}
        </div>
      )}
    </div>
  );
}
