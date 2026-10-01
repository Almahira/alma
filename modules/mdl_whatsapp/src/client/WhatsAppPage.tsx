// File: modules/mdl_whatsapp/src/client/WhatsAppPage.tsx
import React, { useState, useEffect, useMemo } from "react";
import {
  Link2,
  X,
  ShoppingCart,
  Receipt,
  Trash2,
  CheckCircle2,
  MessageSquare,
  Truck,
  Building2,
  Calendar,
  Wallet,
  Check,
  Plus,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { useItemStore } from "../../../mdl_item/src/client/store";
import { useVendorStore } from "../../../mdl_vendor/src/client/store";
import { useOrgStore } from "../../../mdl_organization/src/client/store";
import { useWhatsAppImportStore } from "./useWhatsAppImportStore";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";
import { UniversalCombobox } from "../../../../apps/client_unv/src/shared-ui/UniversalCombobox";
import { getApiUrl } from "../../../../packages/core_unv/src/config/env";
import { ulid } from "ulidx";

export function parseSmartNumber(val: string | number): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let str = String(val).trim();

  if (str.includes(".") && str.includes(",")) {
    if (str.lastIndexOf(",") > str.lastIndexOf(".")) {
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(",")) {
    str = str.replace(",", ".");
  }

  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

function parseFlexibleDate(text: string): string | null {
  if (!text) return null;
  const monthMap: Record<string, string> = {
    jan: "01",
    januari: "01",
    feb: "02",
    februari: "02",
    mar: "03",
    maret: "03",
    apr: "04",
    april: "04",
    mei: "05",
    may: "05",
    jun: "06",
    juni: "06",
    jul: "07",
    juli: "07",
    agu: "08",
    agustus: "08",
    aug: "08",
    sep: "09",
    september: "09",
    sept: "09",
    okt: "10",
    oktober: "10",
    oct: "10",
    nov: "11",
    november: "11",
    des: "12",
    desember: "12",
    dec: "12",
  };

  const textMonthRegex =
    /\b(\d{1,2})[\s\-\/\.]*(jan(?:uari)?|feb(?:ruari)?|mar(?:et)?|apr(?:il)?|mei|may|jun(?:i)?|jul(?:i)?|agu(?:stus)?|aug|sep(?:tember|t)?|okt(?:ober)?|oct|nov(?:ember)?|des(?:ember)?|dec)[\s\-\/\.]*(\d{2,4})\b/i;
  const matchText = text.match(textMonthRegex);
  if (matchText) {
    const day = matchText[1].padStart(2, "0");
    const mStr = matchText[2].toLowerCase();
    const month = monthMap[mStr] || "01";
    let year = matchText[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  const numRegex = /\b(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{2,4})\b/;
  const matchNum = text.match(numRegex);
  if (matchNum) {
    const day = matchNum[1].padStart(2, "0");
    const month = matchNum[2].padStart(2, "0");
    let year = matchNum[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  return null;
}

function similarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  const str1 = String(s1).toLowerCase().trim();
  const str2 = String(s2).toLowerCase().trim();
  if (str1 === str2) return 1.0;
  const longer = str1.length >= str2.length ? str1 : str2;
  const shorter = str1.length < str2.length ? str1 : str2;
  if (longer.length === 0) return 1.0;
  const costs: number[] = [];
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) costs[j] = j;
      else if (j > 0) {
        let newValue = costs[j - 1];
        if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[shorter.length] = lastValue;
  }
  return (longer.length - costs[shorter.length]) / longer.length;
}

export interface ParsedLineItem {
  id: string;
  raw: string;
  rawItemName: string;
  rawQty: number;
  rawUnit: string;
}

const CartItemRow: React.FC<{
  item: {
    id: string;
    itemId: string;
    name: string;
    uom: string;
    qty: number;
    price: number;
    subtotal: number;
  };
  onUpdate: (id: string, field: "qty" | "price", value: number) => void;
  onRemove: (id: string) => void;
}> = ({ item, onUpdate, onRemove }) => {
  const [qtyText, setQtyText] = useState<string>(String(item.qty));
  const [priceText, setPriceText] = useState<string>(String(item.price));

  useEffect(() => {
    setQtyText(String(item.qty));
  }, [item.qty]);

  useEffect(() => {
    setPriceText(String(item.price));
  }, [item.price]);

  const commitQty = (val: string) => {
    const parsed = parseSmartNumber(val);
    if (parsed > 0) {
      onUpdate(item.id, "qty", parsed);
    } else {
      setQtyText(String(item.qty));
    }
  };

  const commitPrice = (val: string) => {
    const parsed = parseSmartNumber(val);
    if (parsed >= 0) {
      onUpdate(item.id, "price", parsed);
    } else {
      setPriceText(String(item.price));
    }
  };

  return (
    <tr className="hover:bg-slate-800/40 transition">
      <td className="p-3">
        <div className="font-bold text-white text-xs tracking-wide">
          {item.name}
        </div>
      </td>

      <td className="p-3 text-center">
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-bold">
          {item.uom}
        </span>
      </td>

      <td className="p-3">
        <input
          type="text"
          inputMode="decimal"
          value={qtyText}
          onChange={(e) => setQtyText(e.target.value)}
          onBlur={() => commitQty(qtyText)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitQty(qtyText);
          }}
          className="w-full text-xs font-bold p-1.5 bg-slate-900 border border-slate-700 rounded text-center font-mono text-white focus:border-orange-500 outline-none"
        />
      </td>

      <td className="p-3">
        <input
          type="text"
          inputMode="decimal"
          value={priceText}
          onChange={(e) => setPriceText(e.target.value)}
          onBlur={() => commitPrice(priceText)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitPrice(priceText);
          }}
          className="w-full text-xs font-bold p-1.5 bg-slate-900 border border-slate-700 rounded text-right font-mono text-blue-400 focus:border-orange-500 outline-none"
        />
      </td>

      <td className="p-3 text-right font-mono font-black text-white text-xs">
        Rp {item.subtotal.toLocaleString("id-ID")}
      </td>

      <td className="p-3 text-center">
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer transition"
          title="Hapus Baris"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
};

export function WhatsAppPage() {
  const { products, uoms } = useItemStore();
  const { vendors } = useVendorStore();
  const { outlets, regions } = useOrgStore();

  const {
    messageIds,
    messages: importedMessages,
    senderName: importSenderName,
    remoteJid: importRemoteJid,
    clearImport,
  } = useWhatsAppImportStore();

  const localCompanyId = localStorage.getItem("__unv_companyId") || "";
  const localRegionId = localStorage.getItem("__unv_regionId") || "";
  const localOutletId = localStorage.getItem("__unv_outletId") || "";
  const isOutletMachine = Boolean(localOutletId);
  const isRegionMachine = Boolean(localRegionId) && !isOutletMachine;

  const [activeTab, setActiveTab] = useState<string>(
    isOutletMachine ? "VENDOR" : "PIUTANG",
  );

  const [dbItemAliases, setDbItemAliases] = useState<Record<string, string>>(
    {},
  );
  const [dbOutletAliases, setDbOutletAliases] = useState<
    Record<string, string>
  >({});

  const [links, setLinks] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<
    Record<string, { qty?: number; price?: number }>
  >({});
  const [linkingLineId, setLinkingLineId] = useState<string | null>(null);
  const [searchCatalog, setSearchCatalog] = useState("");

  const [detectedOutletCandidate, setDetectedOutletCandidate] = useState<
    string | null
  >(null);
  const [isLinkingOutletManual, setIsLinkingOutletManual] = useState(false);

  const generateInternalCode = () =>
    `INT-${Math.floor(100000 + Math.random() * 900000)}`;
  const defaultPaymentMethod = isOutletMachine ? "KASIR" : "KAS_BESAR";

  const [header, setHeader] = useState({
    companyId: localCompanyId,
    regionId: localRegionId,
    outletId: isOutletMachine ? localOutletId : "",
    vendorId: "",
    invoiceNumber: "",
    date: new Date().toISOString().split("T")[0],
    isTempo: true,
    dueDate: new Date(Date.now() + 7 * 864e5).toISOString().split("T")[0],
    paymentMethod: defaultPaymentMethod,
  });

  const [vendorSource, setVendorSource] = useState<"EXTERNAL" | "INTERNAL">(
    activeTab === "GUDANG_REGION" || activeTab === "PIUTANG"
      ? "INTERNAL"
      : "EXTERNAL",
  );

  const [isSaving, setIsSaving] = useState(false);

  const fetchAliases = async () => {
    try {
      const res = await fetch(
        getApiUrl(
          `/api/whatsapp/aliases?companyId=${localCompanyId || "DEFAULT"}`,
        ),
      );
      const data = await res.json();
      if (data) {
        const itemMap: Record<string, string> = {};
        (data.itemAliases || []).forEach((a: any) => {
          itemMap[a.rawAlias.toUpperCase().trim()] = a.itemId;
        });

        const outletMap: Record<string, string> = {};
        (data.outletAliases || []).forEach((a: any) => {
          outletMap[a.rawAlias.toUpperCase().trim()] = a.outletId;
        });

        setDbItemAliases(itemMap);
        setDbOutletAliases(outletMap);
      }
    } catch (err) {
      console.error("[WA ALIAS FETCH ERROR]:", err);
    }
  };

  useEffect(() => {
    fetchAliases();
  }, [localCompanyId]);

  const { parsedLines, detectedDate, detectedOutlet } = useMemo(() => {
    if (!importedMessages || importedMessages.length === 0) {
      return { parsedLines: [], detectedDate: null, detectedOutlet: null };
    }

    const linesFound: ParsedLineItem[] = [];
    let foundDate: string | null = null;
    let foundOutletCandidate: string | null = null;

    importedMessages.forEach((msg, msgIdx) => {
      const normalizedText = (msg.text || "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n");
      const textLines = normalizedText.split("\n");

      let pendingItemName: string | null = null;

      for (let i = 0; i < textLines.length; i++) {
        const rawLine = textLines[i].replace(/[ \t]+/g, " ").trim();
        if (!rawLine || rawLine.startsWith("#")) {
          continue;
        }

        if (
          rawLine.includes("@") &&
          rawLine.length < 50 &&
          !rawLine.match(/\d+\s*(kg|ekor|pcs|pack|dus|btg|ikat)/i)
        ) {
          continue;
        }

        if (!foundDate) {
          const parsedD = parseFlexibleDate(rawLine);
          if (parsedD) {
            foundDate = parsedD;
            continue;
          }
        }

        if (!foundOutletCandidate) {
          const outletMatch = rawLine.match(
            /^(?:po|orderan|tambahan|pesanan)\s+([a-zA-Z0-9\s\(\)]+)/i,
          );
          if (outletMatch) {
            foundOutletCandidate = outletMatch[1]
              .replace(/\(.*?\)/g, "")
              .replace(/[ \t]+/g, " ")
              .trim()
              .toUpperCase();
            continue;
          }
        }

        const itemRegex =
          /^[-*•\d\.\)\s]*([a-zA-Z0-9\s/]+?)\s*[:=–-]?\s*([\d,\.]+)\s*([a-zA-Z]*)$/;
        const m = rawLine.match(itemRegex);

        if (m && m[1] && m[2]) {
          const cleanName = m[1]
            .replace(/[ \t]+/g, " ")
            .trim()
            .toUpperCase();
          if (
            !cleanName.startsWith("PO ") &&
            !cleanName.startsWith("ORDERAN ") &&
            !parseFlexibleDate(cleanName)
          ) {
            linesFound.push({
              id: `line_${msgIdx}_${linesFound.length}_${Date.now()}`,
              raw: rawLine,
              rawItemName: cleanName,
              rawQty: parseSmartNumber(m[2]) || 1,
              rawUnit: (m[3] || "").trim().toLowerCase(),
            });
            pendingItemName = null;
            continue;
          }
        }

        const qtyOnlyRegex = /^[:=–-]?\s*([\d,\.]+)\s*([a-zA-Z]*)$/;
        const qtyMatch = rawLine.match(qtyOnlyRegex);
        if (qtyMatch && pendingItemName) {
          linesFound.push({
            id: `line_${msgIdx}_${linesFound.length}_${Date.now()}`,
            raw: `${pendingItemName} ${rawLine}`,
            rawItemName: pendingItemName,
            rawQty: parseSmartNumber(qtyMatch[1]) || 1,
            rawUnit: (qtyMatch[2] || "").trim().toLowerCase(),
          });
          pendingItemName = null;
          continue;
        }

        if (
          /^[a-zA-Z\s]+$/.test(rawLine) &&
          rawLine.length > 2 &&
          rawLine.length < 50
        ) {
          pendingItemName = rawLine
            .replace(/[ \t]+/g, " ")
            .trim()
            .toUpperCase();
        }
      }
    });

    return {
      parsedLines: linesFound,
      detectedDate: foundDate,
      detectedOutlet: foundOutletCandidate,
    };
  }, [importedMessages]);

  useEffect(() => {
    if (parsedLines.length === 0) return;

    const newLinks: Record<string, string> = {};

    parsedLines.forEach((line) => {
      if (dbItemAliases[line.rawItemName]) {
        newLinks[line.id] = dbItemAliases[line.rawItemName];
        return;
      }

      let bestProd: any = null;
      let highestScore = 0;

      products.forEach((prod) => {
        if (!prod?.name) return;
        const score = similarity(line.rawItemName, prod.name);
        if (score > highestScore) {
          highestScore = score;
          bestProd = prod;
        }
      });

      if (bestProd && highestScore >= 0.65) {
        newLinks[line.id] = bestProd.id;
      }
    });

    setLinks(newLinks);
  }, [parsedLines, dbItemAliases, products]);

  useEffect(() => {
    if (detectedDate) {
      setHeader((prev) => ({
        ...prev,
        date: detectedDate,
        dueDate: new Date(new Date(detectedDate).getTime() + 7 * 864e5)
          .toISOString()
          .split("T")[0],
      }));
    }

    if (detectedOutlet) {
      setDetectedOutletCandidate(detectedOutlet);

      if (dbOutletAliases[detectedOutlet]) {
        setHeader((prev) => ({
          ...prev,
          outletId: dbOutletAliases[detectedOutlet],
        }));
      } else {
        let matchedOutletId = "";
        let bestScore = 0;
        outlets.forEach((o) => {
          const sc = similarity(detectedOutlet, o.name);
          if (sc > bestScore) {
            bestScore = sc;
            matchedOutletId = o.id;
          }
        });
        if (bestScore >= 0.65) {
          setHeader((prev) => ({ ...prev, outletId: matchedOutletId }));
        } else {
          if (isRegionMachine) {
            setHeader((prev) => ({ ...prev, outletId: "" }));
          }
        }
      }
    }
  }, [detectedDate, detectedOutlet, dbOutletAliases, outlets, isRegionMachine]);

  const isInternalB2B =
    activeTab === "PIUTANG" || activeTab === "GUDANG_REGION";

  useEffect(() => {
    if (isRegionMachine) {
      if (activeTab === "PIUTANG") {
        setVendorSource("INTERNAL");
        setHeader((prev) => ({
          ...prev,
          invoiceNumber: prev.invoiceNumber || generateInternalCode(),
          vendorId: localRegionId,
          isTempo: true,
          dueDate: new Date(new Date(prev.date).getTime() + 7 * 864e5)
            .toISOString()
            .split("T")[0],
        }));
      } else if (activeTab === "HUTANG") {
        setVendorSource("EXTERNAL");
        setHeader((prev) => ({
          ...prev,
          invoiceNumber: prev.invoiceNumber.startsWith("INT-")
            ? ""
            : prev.invoiceNumber,
          isTempo: true,
        }));
      } else if (activeTab === "PETTYCASH") {
        setVendorSource("EXTERNAL");
        setHeader((prev) => ({
          ...prev,
          isTempo: false,
          paymentMethod: defaultPaymentMethod,
        }));
      }
    } else {
      if (activeTab === "GUDANG_REGION") {
        setVendorSource("INTERNAL");
        setHeader((prev) => ({
          ...prev,
          vendorId: localRegionId,
          isTempo: true,
          dueDate: new Date(new Date(prev.date).getTime() + 7 * 864e5)
            .toISOString()
            .split("T")[0],
        }));
      } else if (activeTab === "VENDOR") {
        setVendorSource("EXTERNAL");
        setHeader((prev) => ({
          ...prev,
          vendorId: "",
          isTempo: true,
        }));
      } else if (activeTab === "PETTYCASH") {
        setVendorSource("EXTERNAL");
        setHeader((prev) => ({
          ...prev,
          isTempo: false,
          paymentMethod: defaultPaymentMethod,
        }));
      }
    }
  }, [activeTab, isRegionMachine, localRegionId, defaultPaymentMethod]);

  const filteredProducts = useMemo(() => {
    return products.filter((p: any) => {
      const isAct =
        p.status !== undefined
          ? p.status === "Aktif"
          : p.isActive !== undefined
            ? Boolean(p.isActive)
            : true;
      if (
        !isAct ||
        p.approvalStatus === "REJECTED" ||
        p.approvalStatus === "MERGED"
      )
        return false;
      if (localCompanyId && p.companyId && p.companyId !== localCompanyId)
        return false;
      if (localRegionId && p.regionId && p.regionId !== localRegionId)
        return false;

      if (localOutletId) {
        if (p.outletId && p.outletId !== localOutletId) return false;
        if (!p.outletId && p.approvalStatus !== "APPROVED") return false;
        return true;
      } else {
        if (p.outletId) return false;
        return true;
      }
    });
  }, [products, localCompanyId, localRegionId, localOutletId]);

  const externalVendorOptions = useMemo(() => {
    return vendors
      .filter((v: any) => {
        const isAct =
          v.status !== undefined
            ? v.status === "Aktif"
            : v.isActive !== undefined
              ? Boolean(v.isActive)
              : true;
        if (!isAct) return false;
        if (localCompanyId && v.companyId && v.companyId !== localCompanyId)
          return false;
        if (localRegionId && v.regionId && v.regionId !== localRegionId)
          return false;
        if (localOutletId) return !v.outletId || v.outletId === localOutletId;
        return !v.outletId;
      })
      .map((v) => ({ value: v.id, label: v.name }));
  }, [vendors, localCompanyId, localRegionId, localOutletId]);

  const outletOptions = useMemo(() => {
    return outlets
      .filter(
        (o) =>
          (!localRegionId || o.regionId === localRegionId) &&
          (o.status === "Aktif" || o.isActive !== false),
      )
      .map((o) => ({ value: o.id, label: o.name }));
  }, [outlets, localRegionId]);

  const currentRegion = regions.find((r) => r.id === localRegionId);

  const cart = useMemo(() => {
    return Object.entries(links)
      .map(([lineId, productId]) => {
        const line = parsedLines.find((l) => l.id === lineId);
        const prod = products.find((p) => p.id === productId);
        if (!line || !prod) return null;

        const edit = edits[lineId] || {};
        const qty = edit.qty !== undefined ? edit.qty : line.rawQty;

        const targetRegionKey = header.regionId || localRegionId;
        const scopePricing = (targetRegionKey &&
          prod.pricing?.[targetRegionKey]) ||
          prod.pricing?.["DEFAULT"] ||
          prod.pricing?.[Object.keys(prod.pricing || {})[0]] || {
            basePrice: 0,
            marginPercentage: 0,
            sellingPrice: 0,
          };

        let calculatedPrice = 0;
        if (vendorSource === "INTERNAL" || activeTab === "PIUTANG") {
          calculatedPrice =
            scopePricing.sellingPrice || scopePricing.basePrice || 0;
        } else {
          calculatedPrice = scopePricing.basePrice || 0;
        }

        const price = edit.price !== undefined ? edit.price : calculatedPrice;
        const uomName =
          uoms.find((u) => u.id === prod.uomId)?.name || prod.uom || "PCS";

        return {
          id: lineId,
          itemId: prod.id,
          name: prod.name,
          uom: uomName,
          qty,
          price,
          subtotal: Math.round(qty * price),
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      itemId: string;
      name: string;
      uom: string;
      qty: number;
      price: number;
      subtotal: number;
    }>;
  }, [
    links,
    edits,
    parsedLines,
    products,
    uoms,
    header.regionId,
    localRegionId,
    vendorSource,
    activeTab,
  ]);

  const grandTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  const handleUpdateCartRow = (
    id: string,
    field: "qty" | "price",
    value: number,
  ) => {
    setEdits((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleLinkItem = async (lineId: string, productId: string) => {
    const line = parsedLines.find((l) => l.id === lineId);
    setLinks((prev) => ({ ...prev, [lineId]: productId }));
    setLinkingLineId(null);
    setSearchCatalog("");

    if (line) {
      try {
        await fetch(getApiUrl("/api/whatsapp/aliases/item"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: localCompanyId || "DEFAULT",
            rawAlias: line.rawItemName,
            itemId: productId,
          }),
        });
        setDbItemAliases((prev) => ({
          ...prev,
          [line.rawItemName]: productId,
        }));
        sysToast.success(
          "Kamus Tersimpan",
          `Tautan "${line.rawItemName}" disimpan ke database.`,
        );
      } catch (err) {
        console.error("[SAVE ITEM ALIAS ERROR]:", err);
      }
    }
  };

  const handleUnlinkItem = (lineId: string) => {
    setLinks((prev) => {
      const n = { ...prev };
      delete n[lineId];
      return n;
    });
    setEdits((prev) => {
      const n = { ...prev };
      delete n[lineId];
      return n;
    });
  };

  const handleLinkOutletAlias = async (targetOutletId?: string) => {
    const outletToLink = targetOutletId || header.outletId;
    if (!detectedOutletCandidate || !outletToLink) {
      sysToast.error("Peringatan", "Pilih outlet cabang terlebih dahulu!");
      return;
    }

    try {
      await fetch(getApiUrl("/api/whatsapp/aliases/outlet"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: localCompanyId || "DEFAULT",
          rawAlias: detectedOutletCandidate,
          outletId: outletToLink,
        }),
      });
      setDbOutletAliases((prev) => ({
        ...prev,
        [detectedOutletCandidate]: outletToLink,
      }));
      setHeader((prev) => ({ ...prev, outletId: outletToLink }));
      setIsLinkingOutletManual(false);
      sysToast.success(
        "Kamus Cabang Tersimpan",
        `Nama "${detectedOutletCandidate}" berhasil ditautkan.`,
      );
    } catch (err) {
      console.error("[SAVE OUTLET ALIAS ERROR]:", err);
    }
  };

  const resetWorkspaceState = () => {
    clearImport();
    setLinks({});
    setEdits({});
    setLinkingLineId(null);
    setSearchCatalog("");
    setDetectedOutletCandidate(null);
    setIsLinkingOutletManual(false);
    setHeader({
      companyId: localCompanyId,
      regionId: localRegionId,
      outletId: isOutletMachine ? localOutletId : "",
      vendorId: "",
      invoiceNumber: "",
      date: new Date().toISOString().split("T")[0],
      isTempo: true,
      dueDate: new Date(Date.now() + 7 * 864e5).toISOString().split("T")[0],
      paymentMethod: defaultPaymentMethod,
    });
  };

  const handleSaveReceiving = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (cart.length === 0) {
      sysToast.error("Gagal", "Belum ada item yang tertaut di keranjang!");
      return;
    }

    if (activeTab === "PIUTANG") {
      if (!header.outletId) {
        sysToast.error(
          "Gagal",
          "Pilih outlet cabang penerima terlebih dahulu!",
        );
        return;
      }
      const isValidOutlet = outlets.some((o) => o.id === header.outletId);
      if (!isValidOutlet) {
        sysToast.error(
          "Gagal",
          "Outlet cabang yang dipilih tidak valid di sistem!",
        );
        return;
      }
    }

    if (
      (activeTab === "HUTANG" || activeTab === "VENDOR") &&
      !header.vendorId
    ) {
      sysToast.error("Gagal", "Pilih vendor penyedia terlebih dahulu!");
      return;
    }

    setIsSaving(true);
    try {
      const transactionId = `RCV_${ulid()}`;
      const activeDocType =
        activeTab === "PIUTANG"
          ? "PIUTANG"
          : activeTab === "PETTYCASH"
            ? "PETTYCASH"
            : "HUTANG";
      const finalVendorId =
        vendorSource === "INTERNAL" ? localRegionId : header.vendorId;

      await globalCommandBus.execute({
        type: "CREATE_RECEIVING",
        payload: {
          id: transactionId,
          companyId: header.companyId,
          regionId: header.regionId,
          outletId:
            activeTab === "PIUTANG"
              ? header.outletId
              : isOutletMachine
                ? localOutletId
                : null,
          vendorId: finalVendorId,
          vendorSource,
          documentType: activeDocType,
          invoiceNumber: isInternalB2B
            ? header.invoiceNumber || generateInternalCode()
            : header.invoiceNumber || `PO-WA-${header.date.replace(/-/g, "")}`,
          date: header.date,
          isTempo: header.isTempo,
          dueDate: header.isTempo
            ? isInternalB2B
              ? new Date(new Date(header.date).getTime() + 7 * 864e5)
                  .toISOString()
                  .split("T")[0]
              : header.dueDate
            : null,
          paymentMethod: header.paymentMethod,
          items: cart.map((c) => ({
            id: `RITM_${ulid()}`,
            itemId: c.itemId,
            name: c.name,
            qty: c.qty,
            price: c.price,
            subtotal: c.subtotal,
            isExpense: false,
          })),
        },
      });

      if (messageIds.length > 0) {
        await fetch(getApiUrl("/api/whatsapp/messages/link-receiving"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageIds,
            receivingId: transactionId,
          }),
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("UNV_WA_MESSAGES_PROCESSED", {
              detail: { messageIds },
            }),
          );
        }
      }

      sysToast.success(
        "Berhasil Disimpan",
        `Dokumen ${activeDocType} berhasil diterbitkan.`,
      );

      resetWorkspaceState();
    } catch (err: any) {
      console.error("[RECEIVING SUBMIT ERROR]:", err);
      sysToast.error(
        "Error",
        err.message || "Gagal menyimpan dokumen receiving",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const matchedOutletName = useMemo(() => {
    if (!header.outletId) return null;
    return outlets.find((o) => o.id === header.outletId)?.name || null;
  }, [header.outletId, outlets]);

  return (
    <div className="flex h-full w-full bg-slate-900 text-white font-sans overflow-hidden">
      <div className="w-[32%] min-w-[320px] max-w-105 border-r border-slate-700 flex flex-col bg-slate-950 h-full min-h-0 overflow-hidden shrink-0">
        <div className="px-3 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 font-black text-emerald-400 text-xs tracking-wide">
            <MessageSquare className="w-4 h-4" />
            PESAN WHATSAPP MASUK
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
            {Object.keys(links).length} / {parsedLines.length} TERTAUT
          </span>
        </div>

        <div className="flex-1 min-h-0 p-3 flex flex-col">
          {importedMessages.length === 0 ? (
            <div className="p-6 text-center text-slate-500 italic text-xs border-2 border-dashed border-slate-800 rounded-xl">
              Belum ada pesan yang diimpor. Buka drawer chat di samping, centang
              pesan PO, lalu klik{" "}
              <span className="text-emerald-400 font-bold not-italic">
                "IMPORT KE RECEIVING"
              </span>
              .
            </div>
          ) : (
            <div className="bg-[#202c33] rounded-xl shadow-xl border border-white/5 flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-black">
                    WA
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-emerald-400 truncate">
                      {importSenderName}
                    </div>
                    <div className="text-[9px] text-white/40 font-mono truncate">
                      {importRemoteJid}
                    </div>
                  </div>
                </div>
                <span className="text-[9px] text-white/40 font-mono">
                  {importedMessages.length} Pesan
                </span>
              </div>

              <div className="p-2.5 border-b border-white/10 shrink-0">
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-white/5 text-[11px] space-y-2">
                  <div>
                    <div className="flex items-center justify-between text-amber-400 font-bold mb-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Tanggal Transaksi:
                      </span>
                      <span className="text-[9px] text-slate-400 font-normal italic">
                        (Bisa diubah jika typo)
                      </span>
                    </div>
                    <input
                      type="date"
                      value={header.date}
                      onChange={(e) => {
                        const newD = e.target.value;
                        setHeader((p) => ({
                          ...p,
                          date: newD,
                          dueDate: new Date(
                            new Date(newD).getTime() + 7 * 864e5,
                          )
                            .toISOString()
                            .split("T")[0],
                        }));
                      }}
                      className="w-full text-xs font-bold px-2 py-1 bg-slate-950 text-amber-300 border border-amber-500/40 rounded outline-none font-mono"
                    />
                  </div>

                  {detectedOutletCandidate && (
                    <div className="pt-1.5 border-t border-white/10 space-y-1.5">
                      <div className="flex items-center justify-between text-blue-400 font-bold">
                        <span>Cabang Terdeteksi:</span>
                        <span className="font-mono bg-blue-950 px-2 py-0.5 rounded border border-blue-700 text-[10px] text-white">
                          {detectedOutletCandidate}
                        </span>
                      </div>

                      {matchedOutletName ? (
                        <div className="flex items-center justify-between text-emerald-400 text-[10px] font-bold">
                          <span>Tertaut Ke:</span>
                          <span className="inline-flex items-center gap-1 bg-emerald-950/60 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded">
                            <Check className="w-2.5 h-2.5" />{" "}
                            {matchedOutletName}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-amber-400 text-[10px] font-bold">
                            <span>Status Cabang:</span>
                            <span className="inline-flex items-center gap-1 bg-amber-950/60 text-amber-300 border border-amber-800 px-1.5 py-0.5 rounded">
                              <AlertTriangle className="w-2.5 h-2.5" /> Belum
                              Tertaut
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setIsLinkingOutletManual(!isLinkingOutletManual)
                            }
                            className="w-full text-[10px] font-black py-1 px-2 rounded bg-orange-500/20 text-orange-400 border border-orange-500/40 hover:bg-orange-500/30 transition cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> TAUTKAN CABANG INI
                          </button>
                        </div>
                      )}

                      {isLinkingOutletManual && (
                        <div className="p-2 bg-slate-950 rounded border border-orange-500/40 space-y-1.5 animate-in fade-in-50">
                          <label className="block text-[9px] font-bold text-slate-400">
                            Pilih Cabang di Master untuk "
                            {detectedOutletCandidate}":
                          </label>
                          <select
                            className="w-full text-xs font-bold p-1.5 bg-slate-900 border border-slate-700 rounded text-white outline-none"
                            onChange={(e) => {
                              if (e.target.value) {
                                handleLinkOutletAlias(e.target.value);
                              }
                            }}
                            defaultValue=""
                          >
                            <option value="" disabled>
                              -- Pilih Cabang Resmi --
                            </option>
                            {outletOptions.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-white/5 shrink-0">
                Daftar Baris Pesanan:
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
                {parsedLines.map((line) => {
                  const linkedProductId = links[line.id];
                  const linkedProduct = linkedProductId
                    ? products.find((p) => p.id === linkedProductId)
                    : null;
                  const isLinking = linkingLineId === line.id;
                  const uomName = linkedProduct
                    ? uoms.find((u) => u.id === linkedProduct.uomId)?.name ||
                      linkedProduct.uom ||
                      "PCS"
                    : "";

                  return (
                    <div
                      key={line.id}
                      className="bg-slate-900/60 p-2 rounded-lg border border-white/5 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span
                          className={`text-xs ${linkedProduct ? "text-emerald-300 font-medium" : "text-[#e9edef]"}`}
                        >
                          {line.raw}
                        </span>

                        {linkedProduct ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 font-bold flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" />
                              {linkedProduct.name} ({uomName})
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUnlinkItem(line.id)}
                              className="text-white/40 hover:text-rose-400 transition cursor-pointer p-0.5"
                              title="Lepas Tautan"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setLinkingLineId(isLinking ? null : line.id)
                            }
                            className="shrink-0 text-[9px] font-black px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition flex items-center gap-1 cursor-pointer"
                          >
                            <Link2 className="w-2.5 h-2.5" />
                            TAUTKAN
                          </button>
                        )}
                      </div>

                      {isLinking && (
                        <div className="mt-1.5 p-2 bg-slate-800 rounded-lg border border-slate-700 animate-in fade-in-50">
                          <input
                            autoFocus
                            type="text"
                            value={searchCatalog}
                            onChange={(e) => setSearchCatalog(e.target.value)}
                            placeholder="Ketik nama produk..."
                            className="w-full text-xs bg-slate-900 px-2 py-1 rounded border border-slate-700 outline-none focus:border-emerald-500 text-white font-medium mb-1"
                          />
                          <div className="max-h-36 overflow-y-auto space-y-1 custom-scrollbar">
                            {filteredProducts
                              .filter((p) =>
                                p.name
                                  .toLowerCase()
                                  .includes(searchCatalog.toLowerCase()),
                              )
                              .map((p) => {
                                const pUom =
                                  uoms.find((u) => u.id === p.uomId)?.name ||
                                  p.uom ||
                                  "PCS";
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() =>
                                      handleLinkItem(line.id, p.id)
                                    }
                                    className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-slate-700 flex items-center justify-between gap-1 cursor-pointer transition"
                                  >
                                    <span className="truncate text-white font-bold">
                                      {p.name}
                                    </span>
                                    <span className="text-[9px] bg-slate-800 text-emerald-400 font-mono px-1.5 py-0.5 rounded border border-slate-600 shrink-0">
                                      {pUom}
                                    </span>
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="p-3 bg-slate-900 border-t border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSaveReceiving()}
              disabled={isSaving || cart.length === 0}
              className="flex-1 py-2.5 px-4 text-xs font-black text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition active:scale-[0.99]"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> MENYIMPAN...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> SIMPAN DOKUMEN
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                resetWorkspaceState();
                sysToast.info(
                  "Dikosongkan",
                  "Data kloning berhasil dibersihkan.",
                );
              }}
              className="py-2.5 px-4 text-xs font-black text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition cursor-pointer whitespace-nowrap"
            >
              KOSONGKAN
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-slate-900 h-full min-h-0 overflow-hidden">
        <div className="px-3 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-black uppercase tracking-wide">
              FORM DOKUMEN RECEIVING
            </span>
          </div>

          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700 gap-1">
            {isRegionMachine ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab("PIUTANG")}
                  className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "PIUTANG"
                      ? "bg-emerald-600 text-white shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" /> PIUTANG (CABANG)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("HUTANG")}
                  className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "HUTANG"
                      ? "bg-orange-600 text-white shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" /> HUTANG (PASAR)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("PETTYCASH")}
                  className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "PETTYCASH"
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5" /> PETTYCASH
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab("VENDOR")}
                  className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "VENDOR"
                      ? "bg-orange-600 text-white shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" /> VENDOR LUAR
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("GUDANG_REGION")}
                  className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "GUDANG_REGION"
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" /> GUDANG REGION (B2B)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("PETTYCASH")}
                  className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "PETTYCASH"
                      ? "bg-emerald-600 text-white shadow-md"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5" /> PETTYCASH
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700">
            {isInternalB2B ? (
              <div className="grid grid-cols-2 gap-3 items-start">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                    Tanggal Transaksi
                  </label>
                  <input
                    type="date"
                    value={header.date}
                    onChange={(e) => {
                      const newD = e.target.value;
                      setHeader((p) => ({
                        ...p,
                        date: newD,
                        dueDate: new Date(new Date(newD).getTime() + 7 * 864e5)
                          .toISOString()
                          .split("T")[0],
                      }));
                    }}
                    required
                    className="w-full text-xs font-bold p-2 bg-slate-900 text-white border border-slate-700 rounded-lg outline-none font-mono"
                  />
                </div>

                {activeTab === "PIUTANG" ? (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold text-emerald-400 uppercase">
                        Outlet Cabang Tujuan
                      </label>
                      {detectedOutletCandidate &&
                        !dbOutletAliases[detectedOutletCandidate] &&
                        header.outletId && (
                          <button
                            type="button"
                            onClick={() => handleLinkOutletAlias()}
                            className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded font-black hover:bg-emerald-500/30 transition cursor-pointer flex items-center gap-1"
                          >
                            <Plus className="w-2.5 h-2.5" /> TAUTKAN "
                            {detectedOutletCandidate}"
                          </button>
                        )}
                    </div>
                    <UniversalCombobox
                      options={outletOptions}
                      value={header.outletId}
                      onChange={(val) =>
                        setHeader((p) => ({ ...p, outletId: val }))
                      }
                      placeholder="Pilih outlet cabang..."
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-bold text-blue-400 mb-1 uppercase">
                      Pemasok
                    </label>
                    <div className="p-2 bg-blue-950/40 border border-blue-800 rounded-lg text-xs font-bold text-blue-300 flex items-center justify-between">
                      <span className="truncate">
                        GUDANG PUSAT [{currentRegion?.name || "REGIONAL HUB"}]
                      </span>
                      <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-black shrink-0">
                        B2B
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : activeTab === "PETTYCASH" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                    Tanggal Transaksi
                  </label>
                  <input
                    type="date"
                    value={header.date}
                    onChange={(e) =>
                      setHeader((p) => ({ ...p, date: e.target.value }))
                    }
                    required
                    className="w-full text-xs font-bold p-2 bg-slate-900 text-white border border-slate-700 rounded-lg outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">
                    Sumber Dana Kas Kecil
                  </label>
                  <select
                    value={header.paymentMethod}
                    onChange={(e) =>
                      setHeader((p) => ({
                        ...p,
                        paymentMethod: e.target.value,
                      }))
                    }
                    className="w-full text-xs font-bold p-2 bg-slate-900 text-white border border-slate-700 rounded-lg outline-none"
                  >
                    {isOutletMachine ? (
                      <>
                        <option value="KASIR">UANG LACI (KASIR POS)</option>
                        <option value="KAS_BESAR">KAS BESAR TOKO</option>
                        <option value="FINANCE">DANA FINANCE</option>
                      </>
                    ) : (
                      <>
                        <option value="KAS_BESAR">KAS BESAR GUDANG</option>
                        <option value="FINANCE">DANA FINANCE</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                      Tanggal Transaksi
                    </label>
                    <input
                      type="date"
                      value={header.date}
                      onChange={(e) =>
                        setHeader((p) => ({ ...p, date: e.target.value }))
                      }
                      required
                      className="w-full text-xs font-bold p-2 bg-slate-900 text-white border border-slate-700 rounded-lg outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-orange-400 uppercase mb-1">
                      Vendor / Pemasok Eksternal
                    </label>
                    <UniversalCombobox
                      options={externalVendorOptions}
                      value={header.vendorId}
                      onChange={(val) =>
                        setHeader((p) => ({ ...p, vendorId: val }))
                      }
                      placeholder="Pilih nama vendor..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-700">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                      Nomor Referensi / Nota
                    </label>
                    <input
                      type="text"
                      value={header.invoiceNumber}
                      onChange={(e) =>
                        setHeader((p) => ({
                          ...p,
                          invoiceNumber: e.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="Nomor nota fisik vendor..."
                      className="w-full text-xs font-bold p-2 bg-slate-900 text-white border border-slate-700 rounded-lg outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-rose-400 uppercase mb-1">
                      Tanggal Jatuh Tempo
                    </label>
                    <input
                      type="date"
                      value={header.dueDate}
                      onChange={(e) =>
                        setHeader((p) => ({ ...p, dueDate: e.target.value }))
                      }
                      required
                      className="w-full text-xs font-bold p-2 bg-slate-900 border border-slate-700 rounded-lg outline-none text-rose-400 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-blue-400 font-black text-xs uppercase flex items-center gap-2 tracking-wide">
                <ShoppingCart className="w-4 h-4" />
                KERANJANG ITEM TERTAUT
              </div>
              <span className="text-[11px] font-bold text-slate-400 font-mono">
                {cart.length} Item
              </span>
            </div>

            <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-950 flex flex-col max-h-105">
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-800 text-[10px] font-black text-slate-400 uppercase border-b border-slate-700">
                      <th className="px-3 py-1.5 bg-slate-800">Nama Produk</th>
                      <th className="px-3 py-1.5 w-20 text-center bg-slate-800">
                        Satuan
                      </th>
                      <th className="px-3 py-1.5 w-28 text-center bg-slate-800">
                        Qty
                      </th>
                      <th className="px-3 py-1.5 w-36 text-right bg-slate-800">
                        Harga Satuan
                      </th>
                      <th className="px-3 py-1.5 w-36 text-right bg-slate-800">
                        Subtotal
                      </th>
                      <th className="px-3 py-1.5 text-center w-10 bg-slate-800"></th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-800/80">
                    {cart.map((c) => (
                      <CartItemRow
                        key={c.id}
                        item={c}
                        onUpdate={handleUpdateCartRow}
                        onRemove={handleUnlinkItem}
                      />
                    ))}

                    {cart.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="p-6 text-center text-slate-500 italic text-xs"
                        >
                          Belum ada item tertaut. Klik tombol{" "}
                          <span className="text-emerald-400 font-bold not-italic">
                            TAUTKAN
                          </span>{" "}
                          pada panel kiri untuk memetakan barang ke katalog.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-800 px-3 py-2 border-t border-slate-700 flex justify-between items-center shrink-0">
                <span className="font-bold text-slate-400 text-[10px] tracking-wider uppercase">
                  Grand Total Pembelian
                </span>
                <span className="font-black text-emerald-400 text-base font-mono">
                  Rp {grandTotal.toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
