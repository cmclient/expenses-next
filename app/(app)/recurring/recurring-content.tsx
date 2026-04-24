"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Select,
  SelectItem,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { RecurringExpense, AppConfig, VALID_INTERVALS } from "@/lib/types";
import { formatCurrency, formatDate, toDateTimeLocal } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

export default function RecurringContent() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [interval, setInterval] = useState<string>("monthly");
  const [startDate, setStartDate] = useState(toDateTimeLocal());
  const [occurrences, setOccurrences] = useState("12");
  const [submitting, setSubmitting] = useState(false);

  // Delete modal
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteAll, setDeleteAll] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [configRes, recurringRes] = await Promise.all([
        fetch("/api/config"),
        fetch("/api/recurring"),
      ]);
      const configData = await configRes.json();
      const recurringData = await recurringRes.json();
      setConfig(configData);
      setRecurring(recurringData.recurringExpenses || []);
    } catch {
      addToast({ title: t("recurring.failed_load"), color: "danger" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currency = config?.currency || "usd";

  const handleAdd = async () => {
    if (!name.trim() || !category || !amount || !startDate) {
      addToast({ title: t("recurring.fill_fields"), color: "warning" });
      return;
    }
    setSubmitting(true);
    try {
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t);

      const res = await fetch("/api/recurring", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          amount: -Math.abs(parseFloat(amount)),
          category,
          tags: tagList,
          interval,
          startDate: new Date(startDate).toISOString(),
          occurrences: parseInt(occurrences) || 0,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      const data = await res.json();
      addToast({ title: t("recurring.created_instances", { count: data.generated }), color: "success" });
      setName("");
      setAmount("");
      setTags("");
      setOccurrences("12");
      fetchData();
    } catch (err: unknown) {
      addToast({ title: String(err instanceof Error ? err.message : t("recurring.failed_load")), color: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setDeleteAll(true);
    onOpen();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/recurring?id=${encodeURIComponent(deleteId)}&removeAll=${deleteAll}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      addToast({ title: t("recurring.deleted"), color: "success" });
      onClose();
      fetchData();
    } catch {
      addToast({ title: t("recurring.delete_failed"), color: "danger" });
    }
  };

  if (loading || !config)
    return (
      <div className="flex items-center justify-center h-96">
        <Icon icon="solar:loading-bold-duotone" className="animate-spin text-primary" width={48} />
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("recurring.title")}</h1>
        <p className="text-default-400 text-sm">
          {t("recurring.subtitle")}
        </p>
      </div>

      {/* Add Form */}
      <Card>
        <CardHeader className="font-semibold text-lg">{t("recurring.add_title")}</CardHeader>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label={t("common.name")}
              placeholder={t("recurring.name_placeholder")}
              value={name}
              onValueChange={setName}
            />
            <Select
              label={t("common.category")}
              placeholder={t("recurring.select_category")}
              selectedKeys={category ? [category] : []}
              onSelectionChange={(keys) => setCategory(Array.from(keys)[0] as string)}
            >
              {config.categories.map((c) => (
                <SelectItem key={c}>{c}</SelectItem>
              ))}
            </Select>
            <Input
              label={t("common.amount")}
              type="number"
              placeholder={t("recurring.amount_placeholder")}
              value={amount}
              onValueChange={setAmount}
            />
            <Select
              label={t("recurring.interval")}
              selectedKeys={[interval]}
              onSelectionChange={(keys) => setInterval(Array.from(keys)[0] as string)}
            >
              {VALID_INTERVALS.map((i) => (
                <SelectItem key={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</SelectItem>
              ))}
            </Select>
            <Input
              label={t("recurring.start_date")}
              type="datetime-local"
              value={startDate}
              onValueChange={setStartDate}
            />
            <Input
              label={t("recurring.occurrences")}
              type="number"
              placeholder={t("recurring.occurrences_placeholder")}
              value={occurrences}
              onValueChange={setOccurrences}
              description={t("recurring.occurrences_desc")}
            />
          </div>
          <Input
            label={t("common.tags")}
            placeholder={t("recurring.tags_placeholder")}
            value={tags}
            onValueChange={setTags}
          />
          <div className="flex justify-end">
            <Button color="primary" isLoading={submitting} onPress={handleAdd}>
              <Icon icon="solar:add-circle-bold" width={18} />
              {t("recurring.add_recurring")}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* List */}
      <Card>
        <CardHeader className="font-semibold text-lg flex items-center justify-between">
          <span>{t("recurring.active_rules")}</span>
          <Chip size="sm" variant="flat">{recurring.length}</Chip>
        </CardHeader>
        <CardBody className="p-0">
          {recurring.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-default-400">
              <Icon icon="solar:refresh-circle-line-duotone" width={48} />
              <p>{t("recurring.no_recurring")}</p>
            </div>
          ) : (
            <div className="divide-y divide-divider">
              {recurring.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between px-4 py-4 hover:bg-default-50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.name}</span>
                      <Chip size="sm" variant="flat" color="primary">{r.interval}</Chip>
                      <Chip size="sm" variant="flat">{r.category}</Chip>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-default-400">
                      <span>{t("recurring.starts")}: {formatDate(r.startDate)}</span>
                      <span>&middot;</span>
                      <span>{r.occurrences === 0 ? t("recurring.indefinite") : t("recurring.occurrences_count", { count: r.occurrences })}</span>
                      {r.tags?.length > 0 && (
                        <>
                          <span>&middot;</span>
                          {r.tags.map((t) => (
                            <Chip key={t} size="sm" variant="flat" className="text-[10px] h-4">{t}</Chip>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-semibold ${r.amount > 0 ? "text-success" : "text-danger"}`}>
                      {formatCurrency(r.amount, r.currency || currency)}
                    </span>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="danger"
                      onPress={() => confirmDelete(r.id)}
                    >
                      <Icon icon="solar:trash-bin-minimalistic-bold" width={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>{t("recurring.delete_title")}</ModalHeader>
          <ModalBody>
            <p className="text-default-500">{t("recurring.delete_question")}</p>
            <div className="space-y-2 mt-3">
              <Button
                variant={deleteAll ? "solid" : "flat"}
                color={deleteAll ? "danger" : "default"}
                className="w-full justify-start"
                onPress={() => setDeleteAll(true)}
              >
                <Icon icon="solar:trash-bin-minimalistic-bold" width={16} />
                {t("recurring.delete_all")}
              </Button>
              <Button
                variant={!deleteAll ? "solid" : "flat"}
                color={!deleteAll ? "warning" : "default"}
                className="w-full justify-start"
                onPress={() => setDeleteAll(false)}
              >
                <Icon icon="solar:clock-circle-bold" width={16} />
                {t("recurring.delete_future")}
              </Button>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>{t("common.cancel")}</Button>
            <Button color="danger" onPress={handleDelete}>{t("recurring.confirm_delete")}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
