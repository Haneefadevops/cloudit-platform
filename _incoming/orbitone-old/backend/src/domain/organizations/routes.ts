import { Router } from "express";
import { requireUser, requireRole, requireOrgMember, getUser } from "../../middleware/auth.js";
import {
  createOrganization,
  getOrganizationByUserId,
  updateOrganization,
  getOrganizationMembers,
  inviteStaff,
  createStaffProfile,
  OrganizationError
} from "./service.js";
import { organizationInputSchema, inviteStaffSchema, createStaffProfileSchema } from "./schemas.js";

export const organizationsRouter = Router();

organizationsRouter.use(requireUser);

organizationsRouter.post("/", requireRole("freelancer"), async (req, res, next) => {
  try {
    const user = getUser(req);
    const input = organizationInputSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid organization details." });
      return;
    }

    const organization = await createOrganization(user.id, input.data);
    res.status(201).json({ ok: true, data: organization });
  } catch (error) {
    if (error instanceof OrganizationError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

organizationsRouter.get("/me", requireOrgMember, async (req, res, next) => {
  try {
    const user = getUser(req);
    const organization = await getOrganizationByUserId(user.id);
    if (!organization) {
      res.status(404).json({ ok: false, error: "Organization not found." });
      return;
    }
    res.json({ ok: true, data: organization });
  } catch (error) {
    next(error);
  }
});

organizationsRouter.put("/me", requireOrgMember, requireRole("admin"), async (req, res, next) => {
  try {
    const user = getUser(req);
    const input = organizationInputSchema.partial().safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid organization details." });
      return;
    }

    const organization = await updateOrganization(user.id, input.data);
    if (!organization) {
      res.status(404).json({ ok: false, error: "Organization not found." });
      return;
    }
    res.json({ ok: true, data: organization });
  } catch (error) {
    if (error instanceof OrganizationError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

organizationsRouter.get("/members", requireOrgMember, async (req, res, next) => {
  try {
    const user = getUser(req);
    const members = await getOrganizationMembers(user.id);
    res.json({ ok: true, data: members });
  } catch (error) {
    next(error);
  }
});

organizationsRouter.post("/invites", requireOrgMember, requireRole("admin"), async (req, res, next) => {
  try {
    const user = getUser(req);
    const input = inviteStaffSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid invite details." });
      return;
    }

    const invite = await inviteStaff(user.id, input.data);
    res.status(201).json({ ok: true, data: invite });
  } catch (error) {
    if (error instanceof OrganizationError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

organizationsRouter.post("/staff-profiles", requireOrgMember, requireRole("admin"), async (req, res, next) => {
  try {
    const user = getUser(req);
    const input = createStaffProfileSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid staff profile details." });
      return;
    }

    const result = await createStaffProfile(user.id, input.data);
    res.status(201).json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof OrganizationError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});
