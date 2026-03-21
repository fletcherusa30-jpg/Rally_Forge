export function shouldAllowNavigation({ hasUnsavedChanges, currentPath, targetPath, confirmLeave }) {
  if (!hasUnsavedChanges) {
    return true;
  }

  if (!targetPath || currentPath === targetPath) {
    return true;
  }

  void confirmLeave;
  return false;
}
