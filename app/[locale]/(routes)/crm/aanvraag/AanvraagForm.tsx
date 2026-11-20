"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { CHANNELS, type RequestChannel } from "@/lib/sales/labels";
import {
  PROJECT_GROUPS,
  SELLERS,
  isSellerName,
  siteAddressFromBilling,
  type ProjectGroup,
  type SellerName,
} from "@/lib/sales/aanvraag-fields";
import { createAanvraagAction, searchArchitectsAction, searchCustomersAction } from "@/actions/crm/sales/actions";
import { NewAccountForm } from "@/app/[locale]/(routes)/crm/accounts/components/NewAccountForm";
import type { ArchitectHit } from "@/lib/sales/architects";
import type { OfferteboxPrefill } from "@/lib/sales/offertebox";
import type { CustomerHit } from "@/lib/sales/service";
import { AddressBox, emptyAddress, type AddressValue } from "@/components/crm/AddressBox";

const today = new Date().toISOString().slice(0, 10);

function applyCustomerName(current: string, previous: string, next: string) {
  if (!current.trim() || current === previous) return next;
  if (previous && current.startsWith(previous)) return next + current.slice(previous.length);
  return current;
}

function sameAddress(left: AddressValue, right: AddressValue) {
  return (
    left.query === right.query &&
    left.street === right.street &&
    left.postalCode === right.postalCode &&
    left.city === right.city &&
    left.country === right.country
  );
}

export function AanvraagForm({
  projectNumber,
  fromBox,
}: {
  projectNumber: string;
  fromBox?: OfferteboxPrefill | null;
}) {
  const router = useRouter();
  const t = useTranslations("Sales");
  const [channel, setChannel] = useState<RequestChannel>(fromBox ? "EMAIL_OFFERTE" : "PHONE");
  const [priceRequestDate, setPriceRequestDate] = useState(today);
  const [query, setQuery] = useState(fromBox?.fromName ?? "");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [createdNotice, setCreatedNotice] = useState(false);
  const [description, setDescription] = useState(fromBox?.subject ?? "");
  const [prefill, setPrefill] = useState(fromBox?.fromName ?? "");
  const [seller, setSeller] = useState<SellerName | "">(fromBox && isSellerName(fromBox.sellerName) ? fromBox.sellerName : "");
  const [projectGroup, setProjectGroup] = useState<ProjectGroup | "">("");
  const [site, setSite] = useState<AddressValue>(emptyAddress);
  const [copySiteFromCustomer, setCopySiteFromCustomer] = useState(false);
  const [selectedCustomerAddress, setSelectedCustomerAddress] = useState<AddressValue | null>(null);
  const [architectQuery, setArchitectQuery] = useState("");
  const [architectHits, setArchitectHits] = useState<ArchitectHit[]>([]);
  const [architect, setArchitect] = useState<ArchitectHit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return;
    const handle = setTimeout(() => {
      void (async () => {
        const result = await searchCustomersAction(text);
        if (result.error) setError(result.error);
        setHits(result.hits);
      })();
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

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

  const customerChosen = Boolean(accountId);
  const siteSource = accountId ? selectedCustomerAddress : null;

  useEffect(() => {
    if (!copySiteFromCustomer || !siteSource) return;
    setSite((current) => (sameAddress(current, siteSource) ? current : siteSource));
  }, [copySiteFromCustomer, siteSource]);

  function chooseCustomer(hit: CustomerHit) {
    setAccountId(hit.id);
    setCreatedNotice(false);
    setSelectedCustomerAddress(
      siteAddressFromBilling({
        street: hit.street,
        postalCode: hit.postalCode,
        city: hit.city,
        country: hit.country,
      }),
    );
    setQuery(hit.name);
    setDescription((current) => applyCustomerName(current, prefill, hit.projectLabel));
    setPrefill(hit.projectLabel);
    setHits([]);
  }

  function chooseArchitect(hit: ArchitectHit) {
    setArchitect(hit);
    setArchitectQuery(hit.name);
    setArchitectHits([]);
  }

  function onCustomerCreated(customer?: CustomerHit) {
    if (customer) {
      chooseCustomer(customer);
      setCreatedNotice(true);
    }
    setNewCustomerOpen(false);
  }

  async function onCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!accountId) {
      setError(t("errors.customerRequired"));
      return;
    }
    if (!seller || !projectGroup) return;
    setPending(true);
    const result = await createAanvraagAction({
      channel,
      requestDate: priceRequestDate,
      priceRequestDate,
      accountId,
      projectName: description,
      sellerName: seller,
      projectGroup,
      projectStreet: site.street,
      projectPostalCode: site.postalCode,
      projectCity: site.city,
      projectCountry: site.country,
      architectName: architect?.name,
      architectExternalId: architect?.id,
    }, fromBox?.id);
    setPending(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    if ("id" in result && result.id) {
      const ask = "pendingAttachments" in result && result.pendingAttachments ? "?bijlagen=1" : "";
      router.push(`/crm/dossiers/${result.id}${ask}`);
    }
  }

  return (
    <form onSubmit={onCreate} className="tilo-frame max-w-3xl space-y-8 p-5">
      {fromBox && <p className="text-sm text-muted-foreground">{t("offertebox.fromBox")}</p>}
      <section className="grid gap-5 lg:grid-cols-2">
        <h2 className="flex items-center gap-2 text-sm font-medium lg:col-span-2">
          <span aria-hidden className="size-1.5 rounded-full bg-[hsl(var(--tilo))]" />
          {t("dossierSection")}
        </h2>
        <label className="space-y-1 block">
          <span className="text-sm">{t("projectNumber")}</span>
          <Input value={projectNumber} readOnly disabled />
        </label>
        <div className="space-y-1">
          <span className="text-sm">{t("customer")}</span>
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setAccountId(null);
              setCreatedNotice(false);
            }}
            placeholder={t("searchCustomer")}
            aria-label={t("customer")}
            role="combobox"
            aria-expanded={hits.length > 0}
          />
          {hits.length > 0 && !accountId && (
            <ul className="rounded-md border" role="listbox">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => chooseCustomer(hit)}>
                    <span className="font-medium">{hit.name}</span>
                    <span className="block text-muted-foreground">
                      {[hit.email, hit.phone, hit.address].filter(Boolean).join(" · ") || t("noContactDetails")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {accountId && <p className="text-sm">{t("customerLinked")}</p>}
          {createdNotice && (
            <p className="text-sm font-medium" role="status" data-testid="customer-created">
              {t("customerCreated")}
            </p>
          )}
          <Button type="button" variant="outline" onClick={() => setNewCustomerOpen(true)}>
            {t("newCustomer")}
          </Button>
          <CustomerDialog
            open={newCustomerOpen}
            onOpenChange={setNewCustomerOpen}
            besideMail={Boolean(fromBox)}
            title={t("newCustomer")}
            description={t("customerFieldsDescription")}
            cancel={t("cancel")}
          >
            {newCustomerOpen && (
              <NewAccountForm
                initial={accountId ? undefined : { name: query, email: fromBox?.fromEmail ?? "" }}
                onFinish={onCustomerCreated}
              />
            )}
          </CustomerDialog>
        </div>
        <label className="space-y-1 block lg:col-span-2">
          <span className="text-sm">{t("projectDescription")}</span>
          <Input value={description} onChange={(event) => setDescription(event.target.value)} required />
        </label>
        <div className="space-y-1 lg:col-span-2">
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
            <ul className="rounded-md border" role="listbox">
              {architectHits.map((hit) => (
                <li key={hit.id}>
                  <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => chooseArchitect(hit)}>
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
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
          <label className="space-y-1">
            <span className="text-sm">{t("seller")}</span>
            <select
              className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
              value={seller}
              required
              onChange={(event) => setSeller(event.target.value as SellerName)}
            >
              <option value="">{t("choose")}</option>
              {SELLERS.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm">{t("projectGroup")}</span>
            <select
              className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
              value={projectGroup}
              required
              onChange={(event) => setProjectGroup(event.target.value as ProjectGroup)}
            >
              <option value="">{t("choose")}</option>
              {PROJECT_GROUPS.map((group) => (
                <option key={group} value={group}>{t(`groups.${group}`)}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm">{t("priceRequestDate")}</span>
            <Input type="date" value={priceRequestDate} onChange={(event) => setPriceRequestDate(event.target.value)} required />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-sm">{t("channel")}</span>
            <select
              className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
              value={channel}
              onChange={(event) => setChannel(event.target.value as RequestChannel)}
            >
              {CHANNELS.map((item) => (
                <option key={item} value={item}>{t(`channels.${item}`)}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="lg:col-span-2">
        <AddressBox
          label={t("siteAddress")}
          value={site}
          onChange={setSite}
          ignoreQuery={copySiteFromCustomer ? siteSource?.query : null}
          aside={
            <span className="flex flex-col items-start gap-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary disabled:cursor-not-allowed"
                  checked={copySiteFromCustomer}
                  disabled={!customerChosen}
                  onChange={(event) => setCopySiteFromCustomer(event.target.checked)}
                />
                {t("siteSameAsCurrent")}
              </label>
              {!customerChosen && <span className="text-sm text-muted-foreground">{t("chooseCustomerFirst")}</span>}
            </span>
          }
        />
        </div>
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="rounded-full px-5" disabled={pending}>
        {pending ? t("saving") : t("createDossier")}
      </Button>
      <Label className="sr-only">{t("newRequest")}</Label>
    </form>
  );
}

function CustomerDialog({
  open,
  onOpenChange,
  besideMail,
  title,
  description,
  cancel,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  besideMail: boolean;
  title: string;
  description: string;
  cancel: string;
  children: ReactNode;
}) {
  const body = (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {children}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {cancel}
        </Button>
      </DialogFooter>
    </>
  );

  if (!besideMail) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl" data-testid="new-customer-dialog">
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPortal>
        <DialogPrimitive.Content
          data-testid="new-customer-dialog"
          className="fixed top-4 left-4 z-50 grid max-h-[min(90vh,48rem)] w-[min(42rem,calc(100vw-2rem))] gap-4 overflow-y-auto border bg-background p-6 shadow-lg sm:rounded-lg lg:left-64 lg:w-[min(40rem,calc(100vw-46rem))]"
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onFocusOutside={(event) => event.preventDefault()}
        >
          {body}
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <X className="h-4 w-4" />
            <span className="sr-only">{cancel}</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
