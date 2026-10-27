"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ImagePlus, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { initLiff, ensureLoggedIn, getLiffAccessToken } from "@/app/liff/liffClient";
import { fetchAssetContext, submitTicket, ApiClientError } from "@/app/liff/apiClient";
import { SYMPTOM_CATEGORIES, type SymptomCategoryValue } from "@/lib/symptom-categories";

const MAX_IMAGES = 5;

interface AssetInfo {
  assetCode: string;
  model: string | null;
  location: string | null;
  customerName: string | null;
  customerLocation: string | null;
}

function ReportFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assetToken = searchParams.get("asset") ?? "";

  const [loading, setLoading] = useState(true);
  const [asset, setAsset] = useState<AssetInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedCategories, setSelectedCategories] = useState<SymptomCategoryValue[]>([]);
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let ignore = false;

    async function loadAssetContext() {
      if (!assetToken) {
        if (!ignore) {
          setLoadError("ไม่พบข้อมูล QR กรุณาสแกน QR ใหม่อีกครั้ง");
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      setLoadError(null);
      try {
        await initLiff();
        ensureLoggedIn();
        const accessToken = getLiffAccessToken();
        if (!accessToken) return;
        const context = await fetchAssetContext(assetToken, accessToken);
        if (ignore) return;
        setAsset({
          assetCode: context.asset.assetCode,
          model: context.asset.model,
          location: context.asset.location,
          customerName: context.customer.name,
          customerLocation: context.customer.location,
        });
      } catch (error) {
        if (ignore) return;
        if (error instanceof ApiClientError && error.errorCode === "NOT_FRIEND") {
          router.replace(`/liff/add-friend?asset=${encodeURIComponent(assetToken)}`);
          return;
        }
        setLoadError(
          error instanceof ApiClientError
            ? error.message
            : "เกิดข้อผิดพลาดในการโหลดข้อมูลรถ กรุณาลองใหม่อีกครั้ง",
        );
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadAssetContext();
    return () => {
      ignore = true;
    };
  }, [assetToken, router]);

  const toggleCategory = (value: SymptomCategoryValue) =>
    setSelectedCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value],
    );

  const handleAddImages = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).slice(0, MAX_IMAGES - images.length);
    setImages((prev) => [...prev, ...newFiles]);
  };

  const validate = (): string | null => {
    if (selectedCategories.length === 0) return "กรุณาเลือกอาการเสียอย่างน้อย 1 หมวด";
    if (selectedCategories.includes("OTHER") && !description.trim())
      return "กรุณากรอกรายละเอียดเพิ่มเติมเมื่อเลือกหมวด 'อื่นๆ'";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    setSubmitError(null);
    setSubmitting(true);
    try {
      const accessToken = getLiffAccessToken();
      if (!accessToken) throw new Error("ไม่พบข้อมูลการเข้าสู่ระบบ LINE");
      const result = await submitTicket(
        {
          assetToken,
          symptomCategories: selectedCategories,
          description: description.trim() || undefined,
          images,
        },
        accessToken,
      );
      router.push(`/liff/success?ticketNo=${encodeURIComponent(result.ticket.ticketNo)}`);
    } catch (error) {
      setSubmitError(
        error instanceof ApiClientError
          ? error.message
          : "ส่งข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง",
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ========== Loading state ========== */
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">กำลังโหลดข้อมูลรถ...</p>
      </div>
    );
  }

  /* ========== Error state ========== */
  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  /* ========== Form ========== */
  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header bar */}
      <div className="sticky top-0 z-10 bg-primary text-white px-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <p className="font-semibold text-base">แจ้งซ่อมโฟล์คลิฟท์</p>
          {asset && (
            <p className="text-xs text-white/80">
              {asset.assetCode}
              {asset.customerName ? ` · ${asset.customerName}` : ""}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-5">
        {/* Asset info card */}
        {asset && (
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                ข้อมูลรถ
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-muted-foreground">รหัสรถ</span>
              <span className="font-semibold text-foreground">{asset.assetCode}</span>
              {asset.model && (
                <>
                  <span className="text-muted-foreground">รุ่น</span>
                  <span className="text-foreground">{asset.model}</span>
                </>
              )}
              {asset.customerName && (
                <>
                  <span className="text-muted-foreground">ลูกค้า</span>
                  <span className="text-foreground">{asset.customerName}</span>
                </>
              )}
              {(asset.location || asset.customerLocation) && (
                <>
                  <span className="text-muted-foreground">สถานที่</span>
                  <span className="text-foreground">
                    {asset.location ?? asset.customerLocation}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Symptom categories */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">
            อาการเสีย <span className="text-destructive">*</span>
            <span className="text-xs font-normal text-muted-foreground ml-1">
              (เลือกได้มากกว่า 1 หมวด)
            </span>
          </Label>
          <div className="grid grid-cols-1 gap-2">
            {SYMPTOM_CATEGORIES.map((category) => (
              <label
                key={category.value}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <Checkbox
                  checked={selectedCategories.includes(category.value)}
                  onCheckedChange={() => toggleCategory(category.value)}
                />
                <span className="text-sm text-foreground">{category.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-semibold">
            รายละเอียดเพิ่มเติม
            {selectedCategories.includes("OTHER") && (
              <span className="text-destructive ml-1">*</span>
            )}
          </Label>
          <Textarea
            id="description"
            placeholder="อธิบายอาการเสียเพิ่มเติม (ถ้ามี)"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="resize-none"
          />
        </div>

        {/* Image upload */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">
            แนบรูปภาพ{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (สูงสุด {MAX_IMAGES} รูป, เหลือ {MAX_IMAGES - images.length} รูป)
            </span>
          </Label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleAddImages(e.target.files)}
          />

          {/* Image preview grid */}
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((file, index) => (
                <div key={`${file.name}-${index}`} className="relative group aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`รูป ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {/* Add more slot */}
              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <ImagePlus className="w-6 h-6 mb-1" />
                  <span className="text-xs">เพิ่มรูป</span>
                </button>
              )}
            </div>
          )}

          {/* Empty state — show upload button */}
          {images.length === 0 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-8 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <ImagePlus className="w-8 h-8" />
              <span className="text-sm">แตะเพื่อเพิ่มรูปภาพ</span>
              <span className="text-xs">รองรับ JPG, PNG (สูงสุด {MAX_IMAGES} รูป)</span>
            </button>
          )}
        </div>

        {/* Errors */}
        {(validationError || submitError) && (
          <Alert variant="destructive">
            <AlertDescription>{validationError ?? submitError}</AlertDescription>
          </Alert>
        )}

        {/* Submit */}
        <Button className="w-full gap-2" size="lg" onClick={handleSubmit} disabled={submitting}>
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          {submitting ? "กำลังส่ง..." : "ส่งใบแจ้งซ่อม"}
        </Button>
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportFormContent />
    </Suspense>
  );
}
