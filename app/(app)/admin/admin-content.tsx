"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Checkbox,
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
import { useTranslation } from "@/lib/i18n";

interface UserInfo {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
}

export default function AdminContent() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Add user
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [adding, setAdding] = useState(false);

  // Reset password modal
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [resetUser, setResetUser] = useState<UserInfo | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      addToast({ title: t("admin.failed_load"), color: "danger" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAddUser = async () => {
    if (!newUsername.trim() || !newPassword) {
      addToast({ title: t("admin.fill_fields"), color: "warning" });
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          isAdmin: newIsAdmin,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      addToast({ title: t("admin.user_created"), color: "success" });
      setNewUsername("");
      setNewPassword("");
      setNewIsAdmin(false);
      fetchUsers();
    } catch (err: unknown) {
      addToast({ title: String(err instanceof Error ? err.message : t("admin.failed")), color: "danger" });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (user: UserInfo) => {
    if (!confirm(t("admin.delete_confirm", { username: user.username }))) return;
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      addToast({ title: t("admin.user_deleted"), color: "success" });
      fetchUsers();
    } catch (err: unknown) {
      addToast({ title: String(err instanceof Error ? err.message : t("admin.failed")), color: "danger" });
    }
  };

  const handleToggleAdmin = async (user: UserInfo) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, isAdmin: !user.isAdmin }),
      });
      if (!res.ok) throw new Error();
      addToast({ title: `${!user.isAdmin ? t("admin.admin_granted") : t("admin.admin_revoked")}`, color: "success" });
      fetchUsers();
    } catch {
      addToast({ title: t("admin.failed"), color: "danger" });
    }
  };

  const openResetPassword = (user: UserInfo) => {
    setResetUser(user);
    setResetPassword("");
    onOpen();
  };

  const handleResetPassword = async () => {
    if (!resetUser || !resetPassword) return;
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resetUser.id, password: resetPassword }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      addToast({ title: t("admin.password_reset"), color: "success" });
      onClose();
    } catch (err: unknown) {
      addToast({ title: String(err instanceof Error ? err.message : t("admin.failed")), color: "danger" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Icon icon="solar:loading-bold-duotone" className="animate-spin text-primary" width={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("admin.title")}</h1>
        <p className="text-default-400 text-sm">{t("admin.subtitle")}</p>
      </div>

      {/* Add User */}
      <Card>
        <CardHeader className="font-semibold text-lg">
          <Icon icon="solar:user-plus-bold-duotone" className="text-primary mr-2" width={20} />
          Add User
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              label={t("admin.username")}
              placeholder={t("admin.username_placeholder")}
              value={newUsername}
              onValueChange={setNewUsername}
            />
            <Input
              label={t("admin.password")}
              type="password"
              placeholder={t("admin.password_placeholder")}
              value={newPassword}
              onValueChange={setNewPassword}
            />
            <div className="flex items-end gap-3">
              <Checkbox isSelected={newIsAdmin} onValueChange={setNewIsAdmin}>
                <span className="text-sm">{t("admin.is_admin")}</span>
              </Checkbox>
              <Button color="primary" isLoading={adding} onPress={handleAddUser}>
                <Icon icon="solar:add-circle-bold" width={18} />
                {t("admin.add_user_btn")}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader className="font-semibold text-lg flex items-center justify-between">
          <div className="flex items-center">
            <Icon icon="solar:users-group-rounded-bold-duotone" className="text-primary mr-2" width={20} />
            {t("admin.users")}
          </div>
          <Chip size="sm" variant="flat">{users.length}</Chip>
        </CardHeader>
        <CardBody className="p-0">
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-default-400">
              <Icon icon="solar:users-group-rounded-line-duotone" width={48} />
              <p>{t("admin.no_users")}</p>
            </div>
          ) : (
            <div className="divide-y divide-divider">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between px-4 py-3 hover:bg-default-50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Icon
                        icon={user.isAdmin ? "solar:shield-user-bold" : "solar:user-bold"}
                        className="text-primary"
                        width={20}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{user.username}</span>
                        {user.isAdmin && (
                          <Chip size="sm" color="warning" variant="flat">Admin</Chip>
                        )}
                      </div>
                      <p className="text-xs text-default-400">
                        {t("admin.created")} {new Date(user.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="light"
                      onPress={() => handleToggleAdmin(user)}
                      title={user.isAdmin ? t("admin.remove_admin") : t("admin.make_admin")}
                    >
                      <Icon icon={user.isAdmin ? "solar:shield-minus-bold" : "solar:shield-plus-bold"} width={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="light"
                      onPress={() => openResetPassword(user)}
                      title={t("admin.reset_password")}
                    >
                      <Icon icon="solar:key-bold" width={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="light"
                      color="danger"
                      onPress={() => handleDelete(user)}
                      title={t("admin.delete_user")}
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

      {/* Reset Password Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>{t("admin.reset_password_title", { username: resetUser?.username || "" })}</ModalHeader>
          <ModalBody>
            <Input
              label={t("admin.new_password")}
              type="password"
              placeholder={t("admin.password_placeholder")}
              value={resetPassword}
              onValueChange={setResetPassword}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>{t("common.cancel")}</Button>
            <Button color="primary" onPress={handleResetPassword}>{t("admin.reset_password")}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
