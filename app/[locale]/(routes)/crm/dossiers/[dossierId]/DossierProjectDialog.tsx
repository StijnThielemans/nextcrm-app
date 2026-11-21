"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddressBox, type AddressValue } from "@/components/crm/AddressBox";
import { searchArchitectsAction, updateDossierProjectAction } from "@/actions/crm/sales/actions";
import {
  PROJECT_GROUPS,
  SELLERS,
  isSellerName,
  siteAddressFromBilling,
  type ProjectGroup,
  type SellerName,
} from "@/lib/sales/aanvraag-fields";
import type { ArchitectHit } from "@/lib/sales/architects";
import type { DossierDetail } from "@/lib/sales/service";

export function DossierProjectDialog({
  dossier,
  onClose,
  onSaved,
}: {
  dossier: DossierDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("Sales");
  const [description, setDescription] = useState(dossier.name ?? "");
  const [seller, setSeller] = useState<SellerName | "">(isSellerName(dossier.seller ?? "") ? dossier.seller as SellerName : "");
  const [projectGroup, setProjectGroup] = useState<ProjectGroup | "">(
    PROJECT_GROUPS.includes(dossier.projectGroup as ProjectGroup) ? dossier.projectGroup as ProjectGroup : "",
  );
  const [priceRequestDate, setPriceRequestDate] = useState(dossier.priceRequestDate ?? dossier.requestDate ?? "");
  const [site, setSite] = useState<AddressValue>(siteAddressFromBilling({
    street: dossier.projectStreet,
    postalCode: dossier.projectPostalCode,
    city: dossier.projectCity,
    country: dossier.projectCountry,
  }));
  const [architectQuery, setArchitectQuery] = useState(dossier.architectName ?? "");
  const [architectHits, setArchitectHits] = useState<ArchitectHit[]>([]);
  const [architect, setArchitect] = useState<ArchitectHit | null>(
    dossier.architectName && dossier.architectExternalId
      ? { id: dossier.architectExternalId, name: dossier.architectName, city: null, postalCode: null, kind: null }
      : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const text = architectQuery.trim();
    if (text.length < 2 || architect) return;
    const handle = setTimeout(() => {
      void (async () => {
        const result = await searchArchitectsAction(text);
        if (result.error) setError(result.error);
        setArchitectHits(result.hits);
      })();
    }, 300);
    return () => clearTimeout(handle);
  }, [architectQuery, architect]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!seller || !projectGroup) return;
    if (architectQuery.trim() && !architect) {
      setError(t("errors.architectInvalid"));
      return;
    }
    setPending(true);
    const result = await updateDossierProjectAction(dossier.id, {
      projectName: description,
      sellerName: seller,
      projectGroup,
      priceRequestDate,
      projectStreet: site.street,
      projectPostalCode: site.postalCode,
      projectCity: site.city,
      projectCountry: site.country,
      architectName: architect?.name,
      architectExternalId: architect?.id,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid="edit-dossier-project-dialog">
        <DialogHeader>
          <DialogTitle>{t("editProjectData")}</DialogTitle>
          <DialogDescription>{t("editProjectDataDescription")}</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={(event) => void onSubmit(event)}>
          <p className="text-sm">
            <span className="text-muted-foreground">{t("projectNumber")} </span>
            {dossier.number ?? "—"}
          </p>
          <label className="space-y-1 text-sm">
            <span>{t("projectDescription")}</span>
            <Input value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={500} />
          </label>
          <label className="space-y-1 text-sm">
            <span>{t("seller")}</span>
            <select
              className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              value={seller}
              required
              data-testid="dossier-seller-input"
              onChange={(event) => setSeller(event.target.value as SellerName)}
            >
              <option value="">{t("choose")}</option>
              {SELLERS.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <div className="space-y-1">
            <span className="text-sm">{t("architect")}</span>
            <Input
              value={architectQuery}
              onChange={(event) => {
                setArchitectQuery(event.target.value);
                setArchitect(null);
              }}
              placeholder={t("searchArchitect")}
              aria-label={t("architect")}
              role="combobox"
              aria-expanded={architectHits.length > 0}
              autoComplete="off"
            />
            {architectHits.length > 0 && !architect && (
              <ul className="max-h-60 overflow-y-auto rounded-md border" role="listbox">
                {architectHits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setArchitect(hit);
                        setArchitectQuery(hit.name);
                        setArchitectHits([]);
                      }}
                    >
                      <span className="font-medium">{hit.name}</span>
                      <span className="block text-muted-foreground">
                        {[hit.postalCode, hit.city, hit.id].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {architect && (
              <p className="text-sm">{t("architectChosen", { name: architect.name, id: architect.id })}</p>
            )}
            <p className="text-sm text-muted-foreground">{t("architectOptional")}</p>
          </div>
          <label className="space-y-1 text-sm">
            <span>{t("projectGroup")}</span>
            <select
              className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              value={projectGroup}
              required
              data-testid="dossier-project-group-input"
              onChange={(event) => setProjectGroup(event.target.value as ProjectGroup)}
            >
              <option value="">{t("choose")}</option>
              {PROJECT_GROUPS.map((group) => (
                <option key={group} value={group}>{t(`groups.${group}`)}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span>{t("priceRequestDate")}</span>
            <Input type="date" value={priceRequestDate} onChange={(event) => setPriceRequestDate(event.target.value)} required />
          </label>
          <AddressBox label={t("siteAddress")} value={site} onChange={setSite} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t("cancel")}</Button>
            <Button type="submit" disabled={pending} data-testid="save-dossier-project">
              {pending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
