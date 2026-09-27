import { Router } from "express";
import { prisma } from "../utils/prisma";

export const notificationRoutes = Router();

// List notifications. Recipient is resolved by role plus the contact used by
// the caller (admin center passes role=admin; customer passes phone/email).
notificationRoutes.get("/", async (req, res, next) => {
  try {
    const role = String(req.query.role ?? "").trim();
    const phone = String(req.query.phone ?? "").trim().replace(/\D/g, "");
    const email = String(req.query.email ?? "").trim().toLowerCase();
    const unreadOnly = String(req.query.unreadOnly ?? "").trim() === "true";
    if (!role || (role === "customer" && !phone && !email)) {
      return res.status(400).json({ error: "A recipient role (and customer phone/email) is required." });
    }
    const where = {
      recipientRole: role,
      ...(role === "customer"
        ? {
            OR: [
              ...(phone ? [{ recipientPhone: { endsWith: phone.slice(-9) } }] : []),
              ...(email ? [{ recipientEmail: { equals: email } }] : [])
            ]
          }
        : {}),
      ...(unreadOnly ? { readAt: null } : {})
    };
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100
      }),
      prisma.notification.count({ where: { ...where, readAt: null } })
    ]);
    res.json({
      notifications: notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        referenceNo: notification.referenceNo,
        link: notification.link,
        read: notification.readAt !== null,
        createdAt: notification.createdAt.toISOString()
      })),
      unreadCount
    });
  } catch (error) {
    next(error);
  }
});

notificationRoutes.patch("/:id/read", async (req, res, next) => {
  try {
    const updated = await prisma.notification.updateMany({
      where: { id: String(req.params.id), readAt: null },
      data: { readAt: new Date() }
    });
    res.json({ marked: updated.count });
  } catch (error) {
    next(error);
  }
});

notificationRoutes.post("/read-all", async (req, res, next) => {
  try {
    const role = String(req.body?.role ?? "").trim();
    const phone = String(req.body?.phone ?? "").trim().replace(/\D/g, "");
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    if (!role || (role === "customer" && !phone && !email)) {
      return res.status(400).json({ error: "A recipient role (and customer phone/email) is required." });
    }
    const updated = await prisma.notification.updateMany({
      where: {
        recipientRole: role,
        ...(role === "customer"
          ? {
              OR: [
                ...(phone ? [{ recipientPhone: { endsWith: phone.slice(-9) } }] : []),
                ...(email ? [{ recipientEmail: { equals: email } }] : [])
              ]
            }
          : {}),
        readAt: null
      },
      data: { readAt: new Date() }
    });
    res.json({ marked: updated.count });
  } catch (error) {
    next(error);
  }
});
