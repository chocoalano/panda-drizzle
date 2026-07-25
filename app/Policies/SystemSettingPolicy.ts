import {
  allow,
  deny,
  userHasPermission,
  userHasRole,
  type PolicyContext,
  type PolicyUser,
} from "../Support/Policy";

export class SystemSettingPolicy {
  viewAny({ user }: PolicyContext) {
    return this.can(user, "system-settings.view");
  }

  view({ user }: PolicyContext) {
    return this.can(user, "system-settings.view");
  }

  create({ user }: PolicyContext) {
    return this.can(user, "system-settings.create");
  }

  update({ user }: PolicyContext) {
    return this.can(user, "system-settings.update");
  }

  delete({ user }: PolicyContext) {
    return this.can(user, "system-settings.delete");
  }

  private can(user: PolicyUser | null | undefined, permission: string) {
    if (userHasRole(user, "admin") || userHasPermission(user, permission)) {
      return allow();
    }

    return deny(`Missing permission: ${permission}`);
  }
}
