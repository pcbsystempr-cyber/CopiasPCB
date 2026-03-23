import { supabase } from "./supabase.js";

/* =========================================================
   CONFIGURACIÓN DE STORAGE
========================================================= */

const STORAGE_BUCKET = "documentos";

async function ensureStorageBucket() {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      console.error("Error listando buckets:", error);
      return false;
    }
    
    const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET);
    if (!bucketExists) {
      const { error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
        public: true,
        fileSizeLimit: 50,
        allowedMimeTypes: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/jpeg", "image/png"]
      });
      
      if (createError) {
        console.error("Error creando bucket:", createError);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error("Error en ensureStorageBucket:", err);
    return false;
  }
}

async function uploadFileToStorage(file, userId, requestId) {
  try {
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}/${requestId}/${Date.now()}_${file.name}`;
    
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false
      });
    
    if (error) {
      console.error("Error subiendo archivo:", error);
      return null;
    }
    
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);
    
    return {
      path: data.path,
      publicUrl: urlData.publicUrl,
      originalName: file.name
    };
  } catch (err) {
    console.error("Error en uploadFileToStorage:", err);
    return null;
  }
}

function getFileIcon(fileName) {
  if (!fileName) return "fa-file";
  const ext = fileName.split(".").pop()?.toLowerCase();
  const icons = {
    pdf: "fa-file-pdf",
    doc: "fa-file-word",
    docx: "fa-file-word",
    ppt: "fa-file-powerpoint",
    pptx: "fa-file-powerpoint",
    xls: "fa-file-excel",
    xlsx: "fa-file-excel",
    jpg: "fa-file-image",
    jpeg: "fa-file-image",
    png: "fa-file-image"
  };
  return icons[ext] || "fa-file";
}

/* =========================================================
   CONFIGURACIÓN GENERAL
========================================================= */

const ROLE_LABELS = {
  maestro: "Maestro",
  admin: "Administrador"
};

const STATUS_DB_TO_UI = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  impreso: "Impreso",
  listo_recoger: "Listo para recoger",
  entregado: "Entregado",
  cancelado: "Cancelado"
};

const STATUS_UI_TO_DB = {
  Pendiente: "pendiente",
  "En proceso": "en_proceso",
  Impreso: "impreso",
  "Listo para recoger": "listo_recoger",
  Entregado: "entregado",
  Cancelado: "cancelado"
};

const PRIORITY_DB_TO_UI = {
  baja: "Baja",
  media: "Media",
  alta: "Alta"
};

const PRIORITY_UI_TO_DB = {
  Baja: "baja",
  Media: "media",
  Alta: "alta"
};

document.addEventListener("DOMContentLoaded", async () => {
  addGlobalEvents();
  applyStoredTheme();

  const page = getCurrentPage();

  if (page === "index") {
    setupLoginPage();
    return;
  }

  if (page === "maestro") {
    await setupTeacherPage();
    return;
  }

  if (page === "admin") {
    await setupAdminPage();
  }
});

/* =========================================================
   UTILIDADES
========================================================= */

function getCurrentPage() {
  const path = window.location.pathname.toLowerCase();
  if (path.endsWith("/index.html") || path.endsWith("/")) return "index";
  if (path.endsWith("/maestro.html")) return "maestro";
  if (path.endsWith("/admin.html")) return "admin";
  return "unknown";
}

function formatDate(dateValue) {
  if (!dateValue) return "-";
  try {
    return new Intl.DateTimeFormat("es-PR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(dateValue));
  } catch {
    return "-";
  }
}

function formatDateOnly(dateValue) {
  if (!dateValue) return "-";
  try {
    return new Intl.DateTimeFormat("es-PR", {
      dateStyle: "medium"
    }).format(new Date(dateValue));
  } catch {
    return "-";
  }
}

function capitalizeWords(text = "") {
  return text
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function validateInstitutionalEmail(email) {
  return /^de[0-9]+@miescuela\.pr$/i.test(email.trim());
}

function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<strong>${escapeHtml(message)}</strong>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}

function showInlineMessage(el, message, type = "error") {
  if (!el) return;
  el.style.display = "block";
  el.className = `auth-message ${type}`;
  el.textContent = message;
}

function clearInlineMessage(el) {
  if (!el) return;
  el.style.display = "none";
  el.textContent = "";
}

function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  localStorage.setItem("cie_theme", theme);

  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.innerHTML = theme === "dark"
      ? '<i class="fa-regular fa-sun"></i> Modo claro'
      : '<i class="fa-regular fa-moon"></i> Modo oscuro';
  }
}

function applyStoredTheme() {
  const saved = localStorage.getItem("cie_theme") || "light";
  applyTheme(saved);
}

function toggleTheme() {
  const isDark = document.body.classList.contains("dark");
  applyTheme(isDark ? "light" : "dark");
}

function addGlobalEvents() {
  document.getElementById("themeToggle")?.addEventListener("click", toggleTheme);

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "index.html";
  });

  const sidebar = document.getElementById("sidebar");
  document.getElementById("openSidebar")?.addEventListener("click", () => {
    sidebar?.classList.add("show");
  });

  document.getElementById("closeSidebar")?.addEventListener("click", () => {
    sidebar?.classList.remove("show");
  });

  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".nav-link").forEach(item => item.classList.remove("active"));
      link.classList.add("active");
      sidebar?.classList.remove("show");
    });
  });
}

async function getSessionUser() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Error obteniendo sesión:", error);
    return null;
  }
  return data.session?.user ?? null;
}

async function getProfileById(userId, email = "") {
  console.log("Buscando perfil con ID:", userId);

  const { data, error } = await supabase
    .from("perfiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  console.log("Resultado por ID:", data);
  console.log("Error por ID:", error);

  if (data) return data;

  const baseUser = email ? email.split("@")[0].toLowerCase() : "";
  console.log("Buscando por usuario:", baseUser);

  const { data: dataByUser, error: errorByUser } = await supabase
    .from("perfiles")
    .select("*")
    .eq("usuario", baseUser)
    .maybeSingle();

  console.log("Resultado por usuario:", dataByUser);
  console.log("Error por usuario:", errorByUser);

  if (dataByUser) return dataByUser;

  return null;
}

function normalizeStatusForDb(statusLabel) {
  return STATUS_UI_TO_DB[statusLabel] || statusLabel;
}

function statusToUi(statusDb) {
  return STATUS_DB_TO_UI[statusDb] || capitalizeWords(statusDb);
}

function priorityToUi(priorityDb) {
  return PRIORITY_DB_TO_UI[priorityDb] || capitalizeWords(priorityDb);
}

function priorityToDb(priorityUi) {
  return PRIORITY_UI_TO_DB[priorityUi] || priorityUi?.toLowerCase() || "media";
}

/* =========================================================
   LOGIN
========================================================= */

function setupLoginPage() {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  const roleButtons = document.querySelectorAll(".role-btn");
  const roleInput = document.getElementById("role");
  const passwordInput = document.getElementById("password");
  const togglePassword = document.getElementById("togglePassword");
  const loginBtn = document.getElementById("loginBtn");
  const authMessage = document.getElementById("authMessage");

  roleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      roleButtons.forEach((item) => item.classList.remove("active"));
      btn.classList.add("active");
      roleInput.value = btn.dataset.role;
    });
  });

  togglePassword?.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    togglePassword.innerHTML = isPassword
      ? '<i class="fa-regular fa-eye-slash"></i>'
      : '<i class="fa-regular fa-eye"></i>';
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearInlineMessage(authMessage);

    const email = document.getElementById("email")?.value.trim().toLowerCase();
    const password = document.getElementById("password")?.value.trim();
    const userName = document.getElementById("userName")?.value.trim();
    const selectedRole = document.getElementById("role")?.value || "maestro";

    if (!email || !password) {
      showInlineMessage(authMessage, "Completa el correo y la contraseña.");
      return;
    }

    if (selectedRole === "maestro" && !validateInstitutionalEmail(email)) {
      showInlineMessage(authMessage, "Solo se permiten correos tipo de123456@miescuela.pr");
      return;
    }

    loginBtn.disabled = true;
    showInlineMessage(authMessage, "Verificando acceso...", "loading");

    let user = null;

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authData?.user) {
      user = authData.user;
    }

    if (!user && selectedRole === "maestro" && validateInstitutionalEmail(email)) {
      const baseUser = email.split("@")[0];

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nombre: userName || baseUser,
            usuario: baseUser,
            rol: "maestro"
          }
        }
      });

      if (signUpError) {
        console.error("Error creando usuario:", signUpError);
        loginBtn.disabled = false;
        showInlineMessage(authMessage, signUpError.message || "No se pudo crear la cuenta automáticamente.");
        return;
      }

      const { data: secondLoginData, error: secondLoginError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (secondLoginError || !secondLoginData?.user) {
        console.error("Error iniciando sesión tras registro:", secondLoginError);
        loginBtn.disabled = false;
        showInlineMessage(authMessage, "La cuenta fue creada, pero no se pudo iniciar sesión.");
        return;
      }

      user = secondLoginData.user;
    }

    if (!user) {
      console.error("Login falló:", authError);
      loginBtn.disabled = false;
      showInlineMessage(authMessage, "Correo o contraseña incorrectos.");
      return;
    }

    console.log("Usuario autenticado:", user);

    const profile = await getProfileById(user.id, email);
    console.log("Perfil final:", profile);

    if (!profile) {
      loginBtn.disabled = false;
      showInlineMessage(authMessage, "No se encontró el perfil del usuario.");
      return;
    }

    if (profile.rol !== selectedRole) {
      await supabase.auth.signOut();
      loginBtn.disabled = false;
      showInlineMessage(authMessage, "El tipo de acceso seleccionado no coincide con tu cuenta.");
      return;
    }

    showInlineMessage(authMessage, "Acceso correcto. Redirigiendo...", "success");

    setTimeout(() => {
      window.location.href = profile.rol === "admin" ? "admin.html" : "maestro.html";
    }, 700);
  });
}

/* =========================================================
   PANEL MAESTRO
========================================================= */

async function setupTeacherPage() {
  const user = await getSessionUser();
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const profile = await getProfileById(user.id);
  if (!profile || profile.rol !== "maestro") {
    await supabase.auth.signOut();
    window.location.href = "index.html";
    return;
  }

  // Inicializar bucket de storage para documentos
  await ensureStorageBucket();

  setTeacherHeader(profile, user);
  setupTeacherPreview();
  await loadTeacherPageData(user, profile);
  setupTeacherForm(user);
  setupTeacherFilters(user);
}

function setTeacherHeader(profile, user) {
  const displayName = profile.nombre || profile.usuario || "Maestro";

  const teacherName = document.getElementById("teacherName");
  const teacherNameChip = document.getElementById("teacherNameChip");
  const teacherEmail = document.getElementById("teacherEmail");
  const welcomeText = document.getElementById("welcomeText");

  if (teacherName) teacherName.textContent = displayName;
  if (teacherNameChip) teacherNameChip.textContent = displayName;
  if (teacherEmail) teacherEmail.textContent = user.email || "";
  if (welcomeText) welcomeText.textContent = "Bienvenido";
}

function setupTeacherPreview() {
  const fields = [
    "documentName",
    "copies",
    "printType",
    "paperSize",
    "printFormat",
    "urgency",
    "neededAt",
    "instructions",
    "files"
  ];

  fields.forEach(id => {
    document.getElementById(id)?.addEventListener("input", renderTeacherPreview);
    document.getElementById(id)?.addEventListener("change", renderTeacherPreview);
  });

  renderTeacherPreview();
}

function renderTeacherPreview() {
  const preview = document.getElementById("previewContent");
  if (!preview) return;

  const documentName = document.getElementById("documentName")?.value.trim();
  const copies = document.getElementById("copies")?.value.trim();
  const printType = document.getElementById("printType")?.value.trim();
  const paperSize = document.getElementById("paperSize")?.value.trim();
  const printFormat = document.getElementById("printFormat")?.value.trim();
  const urgency = document.getElementById("urgency")?.value.trim();
  const neededAt = document.getElementById("neededAt")?.value;
  const instructions = document.getElementById("instructions")?.value.trim();
  const fileInput = document.getElementById("files");
  const files = Array.from(fileInput?.files || []).map(file => file.name);

  const hasData = [documentName, copies, printType, paperSize, printFormat, urgency, neededAt, instructions, files.length].some(Boolean);

  if (!hasData) {
    preview.className = "preview-content empty-preview";
    preview.innerHTML = `
      <i class="fa-regular fa-file-lines"></i>
      <p>Completa el formulario para ver aquí el resumen de la solicitud.</p>
    `;
    return;
  }

  preview.className = "preview-content";
  preview.innerHTML = `
    <div class="preview-grid">
      <p><strong>Documento:</strong> ${escapeHtml(documentName || "-")}</p>
      <p><strong>Copias:</strong> ${escapeHtml(copies || "-")}</p>
      <p><strong>Tipo:</strong> ${escapeHtml(printType || "-")}</p>
      <p><strong>Papel:</strong> ${escapeHtml(paperSize || "-")}</p>
      <p><strong>Formato:</strong> ${escapeHtml(printFormat || "-")}</p>
      <p><strong>Urgencia:</strong> ${escapeHtml(urgency || "-")}</p>
      <p><strong>Fecha necesaria:</strong> ${neededAt ? formatDate(neededAt) : "-"}</p>
      <p><strong>Archivos:</strong> ${files.length ? escapeHtml(files.join(", ")) : "-"}</p>
      <p><strong>Instrucciones:</strong> ${escapeHtml(instructions || "-")}</p>
    </div>
  `;
}

async function loadTeacherPageData(user) {
  await Promise.all([
    renderTeacherStats(user.id),
    renderTeacherRequests(user.id),
    renderTeacherHistory(user.id),
    renderTeacherNotifications(user.id)
  ]);
}

function setupTeacherForm(user) {
  const requestForm = document.getElementById("requestForm");
  if (!requestForm) return;

  requestForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const documentName = document.getElementById("documentName")?.value.trim();
    const copies = parseInt(document.getElementById("copies")?.value || "0", 10);
    const printType = document.getElementById("printType")?.value.trim();
    const paperSize = document.getElementById("paperSize")?.value.trim();
    const printFormat = document.getElementById("printFormat")?.value.trim();
    const urgency = document.getElementById("urgency")?.value.trim();
    const neededAt = document.getElementById("neededAt")?.value;
    const instructions = document.getElementById("instructions")?.value.trim();
    const filesInput = document.getElementById("files");
    const files = Array.from(filesInput?.files || []);
    const fileNames = files.map(file => file.name);

    if (!documentName || !copies || !printType || !paperSize || !printFormat || !urgency || !neededAt) {
      showToast("Completa todos los campos obligatorios.", "error");
      return;
    }

    // Primero crear la solicitud sin archivo para obtener el ID
    const payload = {
      usuario_id: user.id,
      documento_nombre: documentName,
      copias: copies,
      tipo_impresion: printType,
      tamano_papel: paperSize,
      formato_impresion: printFormat,
      urgencia: priorityToDb(urgency),
      estado: "pendiente",
      fecha_necesaria: neededAt.slice(0, 10),
      archivo_nombre: fileNames.join(", "),
      observaciones: instructions || null
    };

    const { data: insertedRequest, error: insertError } = await supabase
      .from("solicitudes")
      .insert([payload])
      .select()
      .single();

    if (insertError || !insertedRequest) {
      console.error(insertError);
      showToast("No se pudo guardar la solicitud.", "error");
      return;
    }

    // Subir archivos al Storage si existen
    if (files.length > 0) {
      const uploadedFiles = [];
      
      for (const file of files) {
        const uploadResult = await uploadFileToStorage(file, user.id, insertedRequest.id);
        if (uploadResult) {
          uploadedFiles.push(uploadResult);
        }
      }

      // Actualizar la solicitud con las URLs de los archivos
      // Intentamos actualizar el campo archivo_url, si no existe el campo se ignorará
      if (uploadedFiles.length > 0) {
        const fileUrls = uploadedFiles.map(f => f.publicUrl).join(", ");
        try {
          await supabase
            .from("solicitudes")
            .update({ archivo_url: fileUrls })
            .eq("id", insertedRequest.id);
        } catch (err) {
          console.warn("El campo archivo_url no existe en la tabla. Los archivos se guardaron en Storage pero la URL no se pudo guardar en la base de datos.", err);
        }
      }
    }

    await supabase.from("historial_solicitudes").insert([
      {
        solicitud_id: insertedRequest.id,
        usuario_id: user.id,
        accion: "Solicitud creada por el maestro.",
        estado_nuevo: "pendiente",
        creado_por: user.id
      }
    ]);

    showToast("Solicitud enviada correctamente.", "success");
    requestForm.reset();
    renderTeacherPreview();
    await loadTeacherPageData(user);
  });
}

function setupTeacherFilters(user) {
  document.getElementById("teacherSearch")?.addEventListener("input", async () => {
    await renderTeacherRequests(user.id);
  });

  document.getElementById("teacherFilterStatus")?.addEventListener("change", async () => {
    await renderTeacherRequests(user.id);
  });
}

async function getTeacherRequests(userId) {
  const { data, error } = await supabase
    .from("solicitudes")
    .select("*")
    .eq("usuario_id", userId)
    .order("fecha_envio", { ascending: false });

  if (error) {
    console.error("Error cargando solicitudes del maestro:", error);
    return [];
  }

  return data || [];
}

async function renderTeacherStats(userId) {
  const requests = await getTeacherRequests(userId);
  const container = document.getElementById("teacherStats");
  if (!container) return;

  const total = requests.length;
  const active = requests.filter(r => ["pendiente", "en_proceso"].includes(r.estado)).length;
  const ready = requests.filter(r => r.estado === "listo_recoger").length;
  const copies = requests.reduce((acc, item) => acc + (item.copias || 0), 0);

  container.innerHTML = `
    ${statCard("Total de solicitudes", total, "En tu historial general")}
    ${statCard("Pendientes / en proceso", active, "Solicitudes activas")}
    ${statCard("Listas para recoger", ready, "Preparadas en oficina")}
    ${statCard("Copias solicitadas", copies, `${total} solicitudes registradas`)}
  `;
}

function statCard(title, value, subtitle) {
  return `
    <article class="stat-card">
      <h4>${escapeHtml(title)}</h4>
      <strong>${escapeHtml(String(value))}</strong>
      <span>${escapeHtml(subtitle)}</span>
    </article>
  `;
}

async function renderTeacherRequests(userId) {
  const tbody = document.getElementById("teacherRequestsTable");
  if (!tbody) return;

  const search = document.getElementById("teacherSearch")?.value.trim().toLowerCase() || "";
  const statusFilter = document.getElementById("teacherFilterStatus")?.value || "";

  let requests = await getTeacherRequests(userId);

  if (search) {
    requests = requests.filter(item =>
      (item.documento_nombre || "").toLowerCase().includes(search)
    );
  }

  if (statusFilter) {
    const dbStatus = normalizeStatusForDb(statusFilter);
    requests = requests.filter(item => item.estado === dbStatus);
  }

  if (!requests.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">No hay solicitudes que coincidan con la búsqueda.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = requests.map(item => `
    <tr>
      <td>${escapeHtml(item.documento_nombre || "-")}</td>
      <td>${escapeHtml(String(item.copias || 0))}</td>
      <td>${escapeHtml(priorityToUi(item.urgencia))}</td>
      <td><span class="status-pill ${escapeHtml(item.estado)}">${escapeHtml(statusToUi(item.estado))}</span></td>
      <td>${formatDate(item.fecha_envio)}</td>
      <td>${formatDateOnly(item.fecha_necesaria)}</td>
      <td>${escapeHtml(item.archivo_nombre || "-")}</td>
      <td>-</td>
    </tr>
  `).join("");
}

async function renderTeacherHistory(userId) {
  const container = document.getElementById("teacherHistory");
  if (!container) return;

  const { data, error } = await supabase
    .from("historial_solicitudes")
    .select("*")
    .eq("usuario_id", userId)
    .order("fecha", { ascending: false });

  if (error) {
    console.error(error);
    container.innerHTML = `<div class="empty-state">No se pudo cargar el historial.</div>`;
    return;
  }

  if (!data?.length) {
    container.innerHTML = `<div class="empty-state">Todavía no hay historial disponible.</div>`;
    return;
  }

  container.innerHTML = data.map(item => `
    <article class="timeline-item">
      <h4>${escapeHtml(item.accion || "Actividad registrada")}</h4>
      <p>${escapeHtml(statusToUi(item.estado_nuevo || ""))}</p>
      <small>${formatDate(item.fecha)}</small>
    </article>
  `).join("");
}

async function renderTeacherNotifications(userId) {
  const container = document.getElementById("teacherNotifications");
  if (!container) return;

  const { data, error } = await supabase
    .from("notificaciones")
    .select("*")
    .eq("usuario_id", userId)
    .order("creada_en", { ascending: false });

  if (error) {
    console.error(error);
    container.innerHTML = `<div class="empty-state">No se pudieron cargar las notificaciones.</div>`;
    return;
  }

  if (!data?.length) {
    container.innerHTML = `<div class="empty-state">No tienes notificaciones recientes.</div>`;
    return;
  }

  container.innerHTML = data.map(item => `
    <article class="notification-card">
      <h4>${escapeHtml(item.titulo || "Notificación")}</h4>
      <p>${escapeHtml(item.mensaje || "")}</p>
      <small>${formatDate(item.creada_en)}</small>
    </article>
  `).join("");
}

/* =========================================================
   PANEL ADMIN
========================================================= */

async function setupAdminPage() {
  const user = await getSessionUser();
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const profile = await getProfileById(user.id);
  if (!profile || profile.rol !== "admin") {
    await supabase.auth.signOut();
    window.location.href = "index.html";
    return;
  }

  const adminName = document.getElementById("adminName");
  if (adminName) adminName.textContent = profile.nombre || "Administrador";

  setupAdminFilters();
  await loadAdminPageData();
}

function setupAdminFilters() {
  document.getElementById("adminSearch")?.addEventListener("input", loadAdminRequestsOnly);
  document.getElementById("adminFilterStatus")?.addEventListener("change", loadAdminRequestsOnly);
  document.getElementById("adminSort")?.addEventListener("change", loadAdminRequestsOnly);
}

async function loadAdminPageData() {
  await Promise.all([
    renderAdminStats(),
    loadAdminRequestsOnly(),
    renderAdminHistory(),
    renderAdminNotifications()
  ]);
}

async function getAllProfilesMap() {
  const { data, error } = await supabase
    .from("perfiles")
    .select("id, nombre, usuario, rol");

  if (error) {
    console.error(error);
    return new Map();
  }

  return new Map((data || []).map(item => [item.id, item]));
}

async function getAllRequestsMerged() {
  const { data: requests, error } = await supabase
    .from("solicitudes")
    .select("*")
    .order("fecha_envio", { ascending: false });

  if (error) {
    console.error("Error cargando solicitudes admin:", error);
    return [];
  }

  const profilesMap = await getAllProfilesMap();

  return (requests || []).map(item => ({
    ...item,
    perfil: profilesMap.get(item.usuario_id) || null
  }));
}

async function renderAdminStats() {
  const requests = await getAllRequestsMerged();
  const container = document.getElementById("adminStats");
  if (!container) return;

  const total = requests.length;
  const pending = requests.filter(r => r.estado === "pendiente").length;
  const processing = requests.filter(r => r.estado === "en_proceso").length;
  const urgent = requests.filter(r => r.urgencia === "alta").length;
  const copies = requests.reduce((acc, item) => acc + (item.copias || 0), 0);
  const teachers = new Set(requests.map(r => r.usuario_id)).size;

  container.innerHTML = `
    ${statCard("Total de solicitudes", total, "Registro general")}
    ${statCard("Pendientes", pending, "Esperando gestión")}
    ${statCard("En proceso", processing, "Trabajos activos")}
    ${statCard("Urgentes", urgent, "Prioridad alta")}
    ${statCard("Copias totales", copies, "Volumen solicitado")}
    ${statCard("Maestros activos", teachers, "Docentes con solicitudes")}
  `;
}

async function loadAdminRequestsOnly() {
  const tbody = document.getElementById("adminRequestsTable");
  if (!tbody) return;

  let requests = await getAllRequestsMerged();

  const search = document.getElementById("adminSearch")?.value.trim().toLowerCase() || "";
  const statusFilter = document.getElementById("adminFilterStatus")?.value || "";
  const sort = document.getElementById("adminSort")?.value || "newest";

  if (search) {
    requests = requests.filter(item => {
      const teacher = item.perfil?.nombre?.toLowerCase() || "";
      const doc = item.documento_nombre?.toLowerCase() || "";
      return teacher.includes(search) || doc.includes(search);
    });
  }

  if (statusFilter) {
    const dbStatus = normalizeStatusForDb(statusFilter);
    requests = requests.filter(item => item.estado === dbStatus);
  }

  if (sort === "oldest") {
    requests.sort((a, b) => new Date(a.fecha_envio) - new Date(b.fecha_envio));
  } else if (sort === "priority") {
    const order = { alta: 1, media: 2, baja: 3 };
    requests.sort((a, b) => (order[a.urgencia] || 9) - (order[b.urgencia] || 9));
  } else if (sort === "teacher") {
    requests.sort((a, b) => (a.perfil?.nombre || "").localeCompare(b.perfil?.nombre || ""));
  } else {
    requests.sort((a, b) => new Date(b.fecha_envio) - new Date(a.fecha_envio));
  }

  if (!requests.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">No hay solicitudes registradas.</td>
      </tr>
    `;
    return;
  }

  // Generar HTML del archivo con botón de descarga
  const renderFileCell = (item) => {
    const fileName = item.archivo_nombre;
    const fileUrl = item.archivo_url;
    
    if (!fileName) {
      return '<span class="text-muted">-</span>';
    }
    
    const icon = getFileIcon(fileName);
    
    if (fileUrl) {
      // Si hay URL, mostrar botón de descarga
      const urls = fileUrl.split(", ");
      const fileNames = fileName.split(", ");
      
      return urls.map((url, idx) => `
        <a href="${escapeHtml(url)}" 
           download="${escapeHtml(fileNames[idx] || 'documento')}" 
           class="file-download-link" 
           title="Descargar ${escapeHtml(fileNames[idx] || 'archivo')}"
           target="_blank">
          <i class="fa-solid ${escapeHtml(icon)}"></i>
          <span>${escapeHtml(fileNames[idx] || "Descargar")}</span>
        </a>
      `).join("");
    }
    
    // Si no hay URL pero hay nombre, mostrar solo el nombre con icono
    return `
      <span class="file-name-only">
        <i class="fa-solid ${escapeHtml(icon)}"></i>
        ${escapeHtml(fileName)}
      </span>
    `;
  };

  tbody.innerHTML = requests.map(item => `
    <tr>
      <td>${escapeHtml(item.perfil?.nombre || "Sin nombre")}</td>
      <td>${escapeHtml(item.documento_nombre || "-")}</td>
      <td>${renderFileCell(item)}</td>
      <td>${escapeHtml(String(item.copias || 0))}</td>
      <td>${escapeHtml(item.tipo_impresion || "-")}</td>
      <td><span class="priority-pill ${escapeHtml(item.urgencia)}">${escapeHtml(priorityToUi(item.urgencia))}</span></td>
      <td><span class="status-pill ${escapeHtml(item.estado)}">${escapeHtml(statusToUi(item.estado))}</span></td>
      <td>${formatDate(item.fecha_envio)}</td>
      <td>
        <div class="admin-actions">
          <button class="btn btn-soft btn-sm" data-id="${item.id}" data-user="${item.usuario_id}" data-status="en_proceso">En proceso</button>
          <button class="btn btn-soft btn-sm" data-id="${item.id}" data-user="${item.usuario_id}" data-status="impreso">Impreso</button>
          <button class="btn btn-soft btn-sm" data-id="${item.id}" data-user="${item.usuario_id}" data-status="listo_recoger">Listo</button>
          <button class="btn btn-soft btn-sm" data-id="${item.id}" data-user="${item.usuario_id}" data-status="entregado">Entregado</button>
          <button class="btn btn-danger btn-sm" data-id="${item.id}" data-user="${item.usuario_id}" data-status="cancelado">Cancelar</button>
        </div>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("button[data-id]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const requestId = Number(btn.dataset.id);
      const ownerId = btn.dataset.user;
      const newStatus = btn.dataset.status;
      await updateRequestStatus(requestId, ownerId, newStatus);
    });
  });
}

async function updateRequestStatus(requestId, ownerUserId, newStatus) {
  const adminUser = await getSessionUser();
  if (!adminUser) {
    window.location.href = "index.html";
    return;
  }

  const { error: updateError } = await supabase
    .from("solicitudes")
    .update({ estado: newStatus })
    .eq("id", requestId);

  if (updateError) {
    console.error(updateError);
    showToast("No se pudo actualizar el estado.", "error");
    return;
  }

  await supabase.from("historial_solicitudes").insert([
    {
      solicitud_id: requestId,
      usuario_id: ownerUserId,
      accion: `La oficina cambió el estado a ${statusToUi(newStatus)}.`,
      estado_nuevo: newStatus,
      creado_por: adminUser.id
    }
  ]);

  await supabase.from("notificaciones").insert([
    {
      usuario_id: ownerUserId,
      titulo: "Estado actualizado",
      mensaje: `Tu solicitud ahora está en estado: ${statusToUi(newStatus)}.`
    }
  ]);

  showToast("Estado actualizado correctamente.", "success");
  await loadAdminPageData();
}

async function renderAdminHistory() {
  const container = document.getElementById("adminHistory");
  if (!container) return;

  const { data, error } = await supabase
    .from("historial_solicitudes")
    .select("*")
    .order("fecha", { ascending: false });

  if (error) {
    console.error(error);
    container.innerHTML = `<div class="empty-state">No se pudo cargar el historial general.</div>`;
    return;
  }

  const requests = await getAllRequestsMerged();
  const byRequestId = new Map(requests.map(item => [item.id, item]));

  if (!data?.length) {
    container.innerHTML = `<div class="empty-state">No hay historial registrado.</div>`;
    return;
  }

  container.innerHTML = data.map(item => {
    const request = byRequestId.get(item.solicitud_id);
    const teacherName = request?.perfil?.nombre || "Maestro";
    const docName = request?.documento_nombre || "Documento";

    return `
      <article class="timeline-item">
        <h4>${escapeHtml(docName)} · ${escapeHtml(teacherName)}</h4>
        <p>${escapeHtml(item.accion || "")}</p>
        <small>${formatDate(item.fecha)} · Oficina Escolar</small>
      </article>
    `;
  }).join("");
}

async function renderAdminNotifications() {
  const container = document.getElementById("adminNotifications");
  if (!container) return;

  const { data, error } = await supabase
    .from("notificaciones")
    .select("*")
    .order("creada_en", { ascending: false })
    .limit(20);

  if (error) {
    console.error(error);
    container.innerHTML = `<div class="empty-state">No se pudieron cargar las alertas.</div>`;
    return;
  }

  if (!data?.length) {
    container.innerHTML = `<div class="empty-state">No hay alertas recientes.</div>`;
    return;
  }

  container.innerHTML = data.map(item => `
    <article class="notification-card">
      <h4>${escapeHtml(item.titulo || "Alerta")}</h4>
      <p>${escapeHtml(item.mensaje || "")}</p>
      <small>${formatDate(item.creada_en)}</small>
    </article>
  `).join("");
}