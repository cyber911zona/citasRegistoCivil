document.addEventListener('DOMContentLoaded', function() {
    const { jsPDF } = window.jspdf;

    // ELEMENTOS
    const mainContent = document.getElementById('main-content');
    const detailsContent = document.getElementById('details-content');
    const tramiteCards = document.querySelectorAll('.card.tramite');
    const backButtons = document.querySelectorAll('.btn-back');
    const pdfButtons = document.querySelectorAll('.btn-pdf');
    const heroSection = document.getElementById('inicio');
    const chatWindow = document.getElementById('chat-window');
    const navLinks = document.querySelectorAll('header nav a');

    // Modal / Form
    const modalForm = document.getElementById('modal-form');
    const modalContent = document.getElementById('modalContent');
    const formCita = document.getElementById('formCita');
    const closeButton = document.getElementById('closeModal');
    const modalNombreInput = document.getElementById('modalNombre');
    const modalCurpInput = document.getElementById('modalCurp');
    const modalTramiteSelect = document.getElementById('modalTramite');
    const modalFechaInput = document.getElementById('modalFecha');
    const mensajeModal = document.getElementById('mensaje-modal');
    const confirmButton = document.getElementById('confirmButton');
    const deleteButton = document.getElementById('deleteButton');

    // Chat
    const chatToggle = document.getElementById('chat-toggle');
    const chatBody = document.getElementById('chat-body');
    const chatInput = document.getElementById('chat-input');

    // DATOS
    let calendar;
    let scheduledAppointments = JSON.parse(localStorage.getItem('scheduledAppointments')) || [];
    let currentEditingId = null; // si estamos mostrando una cita existente

    // UTIL: generar UUID simple
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // UTIL: formateo YYYY-MM-DD HH:MM (24h)
    function pad(n){ return n < 10 ? '0' + n : n; }
    function formatDateForInput(date) {
        const d = new Date(date);
        const yyyy = d.getFullYear();
        const mm = pad(d.getMonth() + 1);
        const dd = pad(d.getDate());
        const hh = pad(d.getHours());
        const min = pad(d.getMinutes());
        return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    }
    function splitFechaHoraFromInput(inputStr) {
        // espera 'YYYY-MM-DD HH:MM'
        const [fecha, hora] = inputStr.split(' ');
        return { fecha, hora };
    }

    // FUNCIONES para trabajar con eventos del calendario
    function getCalendarEvents() {
        return scheduledAppointments.map(app => ({
            id: app.id,
            title: app.tramite,
            start: app.datetime, // ISO-like 'YYYY-MM-DD HH:MM'
            extendedProps: {
                nombre: app.nombre,
                curp: app.curp
            },
            color: '#2980b9'
        }));
    }

// Inicializar FullCalendar
function initializeCalendar() {
    const calendarEl = document.getElementById('calendar');

    // Configuración
    calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek',
    headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    locale: 'es',
    slotMinTime: '09:00:00',
    slotMaxTime: '15:30:00',
    slotDuration: '00:30:00',
    firstDay: 1,
    nowIndicator: true,
    allDaySlot: false,
    events: getCalendarEvents(),

    dateClick: function(info) {
        const clickedDate = new Date(info.dateStr);
        const today = new Date();
        today.setHours(0,0,0,0);

        if (clickedDate < today) {
            alert("⛔ No se pueden agendar citas en días pasados.");
            return;
        }

        modalFechaInput.value = formatDateForInput(clickedDate);
        openModalForNew();
    },
    eventClick: function(info) {
        const ev = info.event;
        const id = ev.id;
        const appointment = scheduledAppointments.find(a => a.id === id);
        if (appointment) {
            openModalForExisting(appointment);
        } else {
            alert('Evento no encontrado.');
        }
    },
    slotLabelFormat: {
        hour: 'numeric',
        minute: '2-digit',
        omitZeroMinute: false,
        meridiem: 'short'
    },
    slotEventOverlap: false,
    dayCellDidMount: function(info) {
        const today = new Date();
        today.setHours(0,0,0,0);
        if (info.date < today) {
            info.el.classList.add("pasado");
        }
    },
});

    calendar.render();
}

    initializeCalendar();

    // Abrir modal para una nueva cita
    function openModalForNew() {
        currentEditingId = null;
        modalForm.classList.remove('hidden');
        modalNombreInput.value = '';
        modalCurpInput.value = '';
        modalTramiteSelect.value = '';
        confirmButton.textContent = 'Confirmar y Descargar Cita';
        deleteButton.classList.add('hidden');
        mensajeModal.style.display = 'none';
        modalNombreInput.focus();
    }

    // Abrir modal para cita existente (ver / eliminar)
    function openModalForExisting(app) {
        currentEditingId = app.id;
        modalForm.classList.remove('hidden');
        modalNombreInput.value = app.nombre;
        modalCurpInput.value = app.curp;
        modalTramiteSelect.value = app.tramite;
        modalFechaInput.value = app.datetime;
        confirmButton.textContent = 'Guardar cambios y Descargar Cita';
        deleteButton.classList.remove('hidden');
        mensajeModal.style.display = 'none';
    }

    // Cerrar modal
    function closeModal() {
        modalForm.classList.add('hidden');
        currentEditingId = null;
    }

    // Cerrar modal si clic fuera del contenido
    modalForm.addEventListener('click', function(e) {
        if (e.target === modalForm) closeModal();
    });
    closeButton.addEventListener('click', closeModal);

    // Validación básica CURP (patrón aproximado)
    function isValidCURP(curp) {
        if (!curp) return false;
        // patrón simplificado: 18 caracteres alfanuméricos (mayúsculas preferible) 
        return /^[A-Z0-9]{18}$/i.test(curp.trim());
    }

    // Previene agendar dos citas en la misma fecha/hora exacta
    function isSlotTaken(datetime, excludeId = null) {
        return scheduledAppointments.some(a => a.datetime === datetime && a.id !== excludeId);
    }

    // Guardar / crear cita
    formCita.addEventListener('submit', function(e) {
        e.preventDefault();

        const nombre = modalNombreInput.value.trim();
        const curp = modalCurpInput.value.trim().toUpperCase();
        const tramite = modalTramiteSelect.value;
        const fechaCompleta = modalFechaInput.value.trim(); // 'YYYY-MM-DD HH:MM'

        if (!nombre || !curp || !tramite || !fechaCompleta) {
            showMessageModal('Por favor completa todos los campos.', 'error');
            return;
        }

        if (!isValidCURP(curp)) {
            showMessageModal('CURP inválido. Debe tener 18 caracteres alfanuméricos.', 'error');
            return;
        }

        if (isSlotTaken(fechaCompleta, currentEditingId)) {
            showMessageModal('Ya existe una cita en esa fecha/hora. Elige otro horario.', 'error');
            return;
        }

        if (currentEditingId) {
            // Editar cita existente
            const idx = scheduledAppointments.findIndex(a => a.id === currentEditingId);
            if (idx !== -1) {
                scheduledAppointments[idx].nombre = nombre;
                scheduledAppointments[idx].curp = curp;
                scheduledAppointments[idx].tramite = tramite;
                scheduledAppointments[idx].datetime = fechaCompleta;

                // actualizar en calendar
                const ev = calendar.getEventById(currentEditingId);
                if (ev) {
                    ev.setProp('title', tramite);
                    ev.setStart(fechaCompleta);
                    ev.setExtendedProp('nombre', nombre);
                    ev.setExtendedProp('curp', curp);
                }
                saveAppointments();
                showMessageModal('✅ Cita actualizada. Descargando comprobante...', 'exito');
                // descargar PDF con nueva info
                setTimeout(() => {
                    const { fecha, hora } = splitFechaHoraFromInput(fechaCompleta);
                    generarPdfCita(nombre, curp, tramite, fecha, hora);
                    closeModal();
                }, 900);
            } else {
                showMessageModal('Error: cita no encontrada.', 'error');
            }
        } else {
            // Crear nueva cita
            const newAppointment = {
                id: generateUUID(),
                curp: curp,
                datetime: fechaCompleta,
                nombre: nombre,
                tramite: tramite
            };
            scheduledAppointments.push(newAppointment);
            calendar.addEvent({
                id: newAppointment.id,
                title: newAppointment.tramite,
                start: newAppointment.datetime,
                extendedProps: {
                    nombre: newAppointment.nombre,
                    curp: newAppointment.curp,
                },
                color: '#2980b9'
            });
            saveAppointments();
            showMessageModal('✅ Cita registrada. Descargando tu comprobante...', 'exito');
            setTimeout(() => {
                const { fecha, hora } = splitFechaHoraFromInput(fechaCompleta);
                generarPdfCita(nombre, curp, tramite, fecha, hora);
                formCita.reset();
                closeModal();
            }, 900);
        }
    });

    // Botón eliminar cita
    deleteButton.addEventListener('click', function() {
        if (!currentEditingId) return;
        if (!confirm('¿Seguro que deseas eliminar esta cita?')) return;
        // eliminar de scheduledAppointments
        scheduledAppointments = scheduledAppointments.filter(a => a.id !== currentEditingId);
        // eliminar evento del calendar
        const ev = calendar.getEventById(currentEditingId);
        if (ev) ev.remove();
        saveAppointments();
        showMessageModal('Cita eliminada.', 'exito');
        setTimeout(closeModal, 700);
    });

    // Guardar en localStorage
    function saveAppointments() {
        localStorage.setItem('scheduledAppointments', JSON.stringify(scheduledAppointments));
    }

    // Mensajes modal
    function showMessageModal(texto, tipo) {
        mensajeModal.textContent = texto;
        mensajeModal.className = `mensaje ${tipo}`;
        mensajeModal.style.display = "block";
        // Ocultar después de 4s
        setTimeout(() => {
            mensajeModal.style.display = "none";
        }, 4000);
    }

    // Requisitos (igual que antes)
    const requisitos = {
        nacimiento: {
            titulo: "Requisitos para Registro de Nacimiento",
            items: ["Certificado de Nacimiento original (expedido por el hospital).", "Acta de Nacimiento de los padres.", "Identificación oficial vigente de los padres (INE, Pasaporte).", "Acta de Matrimonio (si aplica).", "Dos testigos mayores de edad con identificación oficial."]
        },
        matrimonio: {
            titulo: "Requisitos para Matrimonio Civil",
            items: ["Solicitud de matrimonio debidamente llenada.", "Acta de nacimiento reciente de ambos contrayentes.", "Identificación oficial vigente de ambos.", "CURP de ambos contrayentes.", "Análisis clínicos prenupciales (con vigencia no mayor a 15 días).", "Constancia de soltería (si alguno es de otro estado).", "Dos testigos por cada contrayente con identificación oficial."]
        },
        defuncion: {
            titulo: "Requisitos para Acta de Defunción",
            items: ["Certificado Médico de Defunción en formato original.", "Identificación oficial del fallecido.", "Acta de nacimiento del fallecido.", "Identificación oficial del declarante (familiar o responsable).", "CURP del fallecido."]
        },
        otros: {
            titulo: "Requisitos para Copias Certificadas",
            items: ["Nombre completo de la persona registrada en el acta.", "Fecha exacta de nacimiento, matrimonio, etc.", "Lugar de registro (municipio, estado).", "CURP (si se tiene).", "Identificación oficial del solicitante.", "Comprobante de pago de derechos."]
        }
    };

    // Generar PDF requisitos
    function generarPdfRequisitos(tramiteId) {
        const doc = new jsPDF();
        const data = requisitos[tramiteId];
        if (!data) return;
        doc.setFontSize(18);
        doc.text("Registro Civil de Nogales, Veracruz", 105, 20, null, null, "center");
        doc.setFontSize(16);
        doc.text(data.titulo, 105, 30, null, null, "center");
        doc.setFontSize(12);
        let y = 50;
        data.items.forEach(item => {
            doc.text(`• ${item}`, 15, y, { maxWidth: 180 });
            y += 10;
            if (y > 270) { doc.addPage(); y = 20; } // paginación simple
        });
        doc.save(`requisitos_${tramiteId}.pdf`);
    }

    // conectar botones PDF
    pdfButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tramiteId = this.dataset.tramite;
            generarPdfRequisitos(tramiteId);
        });
    });

    // Generar PDF de cita (fecha/hora pasan separados)
    function generarPdfCita(nombre, curp, tramite, fecha, hora) {
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.text("Comprobante de Cita - Registro Civil", 105, 22, null, null, "center");
        doc.setFontSize(16);
        doc.text("Nogales, Veracruz", 105, 32, null, null, "center");
        doc.setFontSize(12);
        doc.text("Datos del Solicitante:", 20, 50);
        doc.text(`Nombre: ${nombre}`, 20, 60);
        doc.text(`CURP: ${curp}`, 20, 70);
        doc.text("Detalles de la Cita:", 20, 90);
        doc.text(`Trámite: ${tramite}`, 20, 100);
        doc.text(`Fecha: ${fecha}`, 20, 110);
        doc.text(`Hora: ${hora}`, 20, 120);
        doc.setLineWidth(0.5);
        doc.line(20, 140, 190, 140);
        doc.setFontSize(12);
        doc.text("Instrucciones Importantes:", 105, 150, null, null, "center");
        doc.setFontSize(10);
        doc.text("• Favor de presentarse 15 minutos antes de la hora de su cita.", 20, 160, { maxWidth: 170 });
        doc.text("• Presentar este comprobante impreso o en su dispositivo móvil.", 20, 170, { maxWidth: 170 });
        doc.text("• No olvide traer toda la documentación requerida en original y copia.", 20, 180, { maxWidth: 170 });
        doc.save(`cita_registro_civil_${curp}.pdf`);
    }

    // HERO - carrusel simple (preload)
    const heroImages = [
        'img/portada01.jpg',
        'img/portada02.jpg',
        'img/portada03.jpg',
        'img/portada04.jpg',
        'img/portada05.jpg',
        'img/portada06.jpg'
    ];
    let currentImageIndex = 0;
    function changeHeroImage() {
        currentImageIndex = (currentImageIndex + 1) % heroImages.length;
        heroSection.style.backgroundImage = `url('${heroImages[currentImageIndex]}')`;
    }
    if (heroImages.length > 0) {
        // preloads
        heroImages.forEach(src => { const i = new Image(); i.src = src; });
        heroSection.style.backgroundImage = `url('${heroImages[0]}')`;
        setInterval(changeHeroImage, 10000);
    }

    // NAVEGACIÓN entre vistas trámites / main
    function showDetails(tramiteId) {
        mainContent.classList.add('hidden');
        detailsContent.classList.remove('hidden');
        document.querySelectorAll('.detalle-tramite').forEach(section => section.classList.add('hidden'));
        const detailSection = document.getElementById(`detalle-${tramiteId}`);
        if (detailSection) detailSection.classList.remove('hidden');
        window.scrollTo(0, 0);
    }
    function showMainContent() {
        mainContent.classList.remove('hidden');
        detailsContent.classList.add('hidden');
    }

    tramiteCards.forEach(card => {
        card.addEventListener('click', function(e) {
            e.preventDefault();
            const tramiteId = this.dataset.tramite;
            showDetails(tramiteId);
        });
    });

    backButtons.forEach(button => {
        button.addEventListener('click', function() {
            showMainContent();
            document.getElementById('tramites').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#inicio') {
                showMainContent();
            } else {
                e.preventDefault();
                showMainContent();
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    setTimeout(() => {
                        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                }
            }
        });
    });

    // CHATBOT (básico)
    setTimeout(() => {
        chatWindow.classList.remove('hidden');
        addInitialMessage();
    }, 1500);

    function addInitialMessage() {
        const initialText = "Hola 👋 ¿En qué puedo ayudarte? Puedes preguntar por 'acta', 'matrimonio', etc.";
        addMessage(initialText, "bot");
    }

    chatToggle.addEventListener('click', () => {
        chatWindow.classList.toggle('hidden');
        if (!chatWindow.classList.contains('hidden')) chatInput.focus();
    });

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === "Enter") {
            const userMsg = chatInput.value.trim();
            if (userMsg !== "") {
                addMessage(userMsg, "user");
                responderBot(userMsg);
                chatInput.value = "";
            }
        }
    });

    function addMessage(text, sender) {
        const messageContainer = document.createElement("div");
        messageContainer.className = sender === 'user' ? 'user-message' : 'bot-message';
        const p = document.createElement("p");
        p.textContent = text;
        if (sender === 'bot') p.classList.add('animated-message');
        messageContainer.appendChild(p);
        chatBody.appendChild(messageContainer);
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    const knowledgeBase = {
        nacimiento: { keywords: ["acta", "nacimiento", "registrar bebe"], response: "Claro, te muestro la información para el Registro de Nacimiento.", tramiteId: "nacimiento" },
        matrimonio: { keywords: ["matrimonio", "casarse", "boda"], response: "Perfecto, aquí tienes los detalles sobre el Matrimonio Civil.", tramiteId: "matrimonio" },
        defuncion: { keywords: ["defuncion", "fallecimiento"], response: "Entendido, te presento los requisitos para el Acta de Defunción.", tramiteId: "defuncion" },
        copias: { keywords: ["copia", "copias certificadas", "certificado"], response: "Te redirijo a la sección de Copias Certificadas.", tramiteId: "otros" },
        saludo: { keywords: ["hola", "buenos dias", "buenas tardes"], response: "¡Hola! Soy el asistente virtual. Pregúntame sobre 'nacimiento', 'matrimonio' o 'copias'." },
        horarios: { keywords: ["horario", "abren", "cierran", "horas"], response: "Atendemos de Lunes a Viernes de 9:00 AM a 3:00 PM, y Sábados de 9:00 AM a 1:00 PM." },
        costos: { keywords: ["costo", "precio", "pago", "cuanto cuesta"], response: "Los costos varían por trámite. El pago se realiza en la tesorería municipal. Te recomendamos consultar directamente en oficinas para el monto exacto." },
        gracias: { keywords: ["gracias", "ok", "muy bien"], response: "¡De nada! Estoy para servirte. 😊" }
    };

    function responderBot(msg) {
        const lowerMsg = msg.toLowerCase();
        let botResponse = "Lo siento, no entendí. Intenta con 'requisitos de matrimonio' o 'costos'.";
        let actionTramiteId = null;
        for (const key in knowledgeBase) {
            if (knowledgeBase[key].keywords.some(keyword => lowerMsg.includes(keyword))) {
                botResponse = knowledgeBase[key].response;
                if (knowledgeBase[key].tramiteId) actionTramiteId = knowledgeBase[key].tramiteId;
                break;
            }
        }
        setTimeout(() => {
            addMessage(botResponse, "bot");
            if (actionTramiteId) {
                setTimeout(() => {
                    showDetails(actionTramiteId);
                    chatWindow.classList.add('hidden');
                }, 800);
            }
        }, 300);
    }

    // Carga inicial de citas desde localStorage al calendar
    function refreshCalendarEvents() {
        // primero borrar eventos actuales y volver a crear
        calendar.getEvents().forEach(ev => ev.remove());
        getCalendarEvents().forEach(e => calendar.addEvent(e));
    }

    // Se asegura de sincronizar visualización con datos guardados
    refreshCalendarEvents();

    // (opcional) Exponer una función para pruebas en consola
    window.__APP = {
        scheduledAppointments,
        refreshCalendarEvents,
        saveAppointments
    };
});
