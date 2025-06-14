let subjects = [];
let editIndex = -1;

function addSubject() {
  const subject = document.getElementById("subject").value;
  const units = parseFloat(document.getElementById("units").value);
  const grade = parseFloat(document.getElementById("grade").value);

  if (!subject || isNaN(units) || isNaN(grade)) {
    alert("Please fill in all fields.");
    return;
  }

  const newSubject = { subject, units, grade };

  if (editIndex === -1) {
    subjects.push(newSubject); // Add new
  } else {
    subjects[editIndex] = newSubject; // Update existing
    editIndex = -1; // Reset after editing
  }

  renderTable();
  clearForm();
}

function updateGrade(index, value) {
  const grade = parseFloat(value);
  if (!isNaN(grade) && grade >= 1 && grade <= 5) {
    subjects[index].grade = grade;
  } else {
    alert("Please enter a valid grade (1.00 to 5.00)");
    renderTable(); // Revert input if invalid
  }
}

function updateUnits(index, value) {
  const units = parseFloat(value);
  if (!isNaN(units) && units > 0) {
    subjects[index].units = units;
  } else {
    alert("Please enter a valid number of units (greater than 0)");
    renderTable(); // revert changes
  }
}

function deleteSubject(index) {
  subjects.splice(index, 1);
  renderTable();
}

function editSubject(index) {
  const s = subjects[index];
  document.getElementById("subject").value = s.subject;
  document.getElementById("units").value = s.units;
  document.getElementById("grade").value = s.grade;
}

function renderTable() {
  const tbody = document.querySelector("#subjectTable tbody");
  tbody.innerHTML = "";

  subjects.forEach((s, index) => {
    const row = document.createElement("tr");

    row.innerHTML = `
       <td>${index + 1}. ${s.subject}</td>
        <td>
          <input type="number" min="1" value="${s.units}" 
                 onchange="updateUnits(${index}, this.value)" />
        </td>
        <td>
          <input type="number" min="1" max="5" step="0.01" value="${s.grade}" 
                 onchange="updateGrade(${index}, this.value)" />
        </td>
        <td>
        <button class="delete-btn" onclick="deleteSubject(${index})">
        <img src="https://cdn-icons-png.flaticon.com/512/3096/3096673.png" alt="Delete" class="trash-icon" />
        </button>
        </td>
      `;

    tbody.appendChild(row);
  });
}

function calculateGWA() {
  if (subjects.length === 0) {
    alert("No subjects added.");
    return;
  }

  let totalWeighted = 0;
  let totalUnits = 0;

  subjects.forEach((s) => {
    totalWeighted += s.grade * s.units;
    totalUnits += s.units;
  });

  const gwa = (totalWeighted / totalUnits).toFixed(4);
  const resultElement = document.getElementById("gwaResult");
  resultElement.innerText = `🎓 Your GWA is ${gwa}`;

  // Show the output block now
  document.getElementById("gwaOutput").classList.remove("hidden");
  document.getElementById("gwaOutput").scrollIntoView({
    behavior: "smooth",
  });
}

function clearForm() {
  document.getElementById("subject").value = "";
  document.getElementById("units").value = "";
  document.getElementById("grade").value = "";
}

function extractFromCOR() {
  const file = document.getElementById("corUpload").files[0];
  if (!file) {
    alert("Please upload a COR file first.");
    return;
  }

  const fileType = file.type;

  if (fileType === "application/pdf") {
    extractTextFromPDF(file);
  } else if (fileType.startsWith("image/")) {
    extractTextFromImage(file);
  } else {
    alert("Unsupported file type. Please upload an image or PDF.");
  }
}

function extractTextFromImage(imageFile) {
  document.getElementById("imageLoader").style.display = "block"; // Show loader

  Tesseract.recognize(imageFile, "eng", {
    logger: (m) => console.log(m),
  })
    .then(({ data: { text } }) => {
      console.log("Extracted Text (Image):", text);
      parseScreenshotText(text);
    })
    .catch((err) => {
      console.error("Tesseract error:", err);
      alert("OCR failed. Please upload a clearer image.");
    })
    .finally(() => {
      document.getElementById("imageLoader").style.display = "none"; // Hide loader
    });
}

function extractTextFromPDF(pdfFile) {
  const fileReader = new FileReader();
  fileReader.onload = function () {
    const typedarray = new Uint8Array(this.result);

    pdfjsLib.getDocument({ data: typedarray }).promise.then(function (pdf) {
      let pagesPromises = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        pagesPromises.push(
          pdf.getPage(i).then((page) => {
            return page.getTextContent().then((textContent) => {
              return textContent.items.map((item) => item.str).join(" ");
            });
          })
        );
      }

      Promise.all(pagesPromises).then((pagesText) => {
        const fullText = pagesText.join("\n");
        console.log("Extracted Text (PDF):", fullText);
        parseCORText(fullText);
      });
    });
  };
  fileReader.readAsArrayBuffer(pdfFile);
}

function parseCORText(text) {
  const subjectsFound = [];

  const subjectRegex =
    /(\d)\s+(\d)\s+(\d)\s+([A-Z][a-zA-Z0-9\s\-&,]+?)\s+([A-Z]{3,10}\s?\d{3})\s+INFO/gi;

  let match;
  while ((match = subjectRegex.exec(text)) !== null) {
    const num1 = parseInt(match[1]);
    const num2 = parseInt(match[2]);
    const num3 = parseInt(match[3]);

    const credit = Math.max(num1, num2, num3); // pick the largest one as Credit
    const subjectTitle = match[4].trim();
    const subjectCode = match[5].trim();

    subjects.push({
      subject: subjectTitle,
      units: credit,
      grade: "",
    });

    subjectsFound.push(`${subjectTitle} (${credit} units)`);
  }

  if (subjectsFound.length === 0) {
    alert("No subjects found. Please ensure the COR is readable.");
  } else {
    console.log("Extracted subjects:", subjectsFound);
    renderTable();
  }
}

function parseScreenshotText(text) {
  const lines = text.split("\n");
  const subjectsFound = [];

  for (let rawLine of lines) {
    let line = rawLine.trim();

    if (
      line.toLowerCase().includes("descriptive") ||
      line.toLowerCase().includes("remarks") ||
      line.toLowerCase().includes("final") ||
      line.toLowerCase().includes("section") ||
      line.toLowerCase().includes("grade") ||
      line.startsWith("#") ||
      line.length < 10
    ) {
      continue;
    }

    const tokens = line.split(/\s+/);

    // Find grade
    let gradeRaw = tokens[tokens.length - 1];
    let grade = "";
    if (/^\d{3}$/.test(gradeRaw)) {
      grade = (parseInt(gradeRaw) / 100).toFixed(2);
    } else if (/^\d(\.\d{1,2})$/.test(gradeRaw)) {
      grade = gradeRaw;
    } else {
      gradeRaw = tokens[tokens.length - 2];
      if (/^\d{3}$/.test(gradeRaw)) {
        grade = (parseInt(gradeRaw) / 100).toFixed(2);
      } else if (/^\d(\.\d{1,2})$/.test(gradeRaw)) {
        grade = gradeRaw;
      } else {
        grade = "";
      }
    }

    // Find units
    let unitIndex = -1;
    for (let j = tokens.length - 2; j >= 0; j--) {
      if (/^\d{1,2}$/.test(tokens[j])) {
        unitIndex = j;
        break;
      }
    }

    if (unitIndex === -1) continue;
    const units = parseInt(tokens[unitIndex]);

    // Get raw subject text
    let subjectTokens = tokens.slice(0, unitIndex);

    // Clean subject title: remove line number + code like "2.", "CBME11", "413"
    if (subjectTokens[0].match(/^\d+\.?$/)) subjectTokens.shift(); // remove "1."
    if (subjectTokens[0] && subjectTokens[0].match(/^[A-Z]{2,}\d{0,3}$/i))
      subjectTokens.shift(); // remove code
    if (subjectTokens[0] && subjectTokens[0].match(/^\d{3}$/))
      subjectTokens.shift(); // remove numeric code like "413"

    const subject = subjectTokens.join(" ").trim();

    if (subject && units > 0) {
      subjects.push({ subject, units, grade });
      subjectsFound.push(
        `${subject} | ${units} units | Grade: ${grade || "(blank)"}`
      );
    }
  }

  if (subjectsFound.length === 0) {
    alert(
      "No valid subjects found. Ensure Descriptive, Units, and Final Average are visible."
    );
  } else {
    console.log("✅ Extracted subjects (from image):", subjectsFound);
    renderTable();
  }
}

document.getElementById("corUpload").addEventListener("change", extractFromCOR);

document.getElementById("imageUpload").addEventListener("change", function () {
  const file = this.files[0];
  if (file && file.type.startsWith("image/")) {
    extractTextFromImage(file);
  } else {
    alert("Please upload a valid image screenshot.");
  }
});

function openModal() {
  document.getElementById("infoModal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("infoModal").classList.add("hidden");
}

function submitInfo() {
  const fullName = document.getElementById("inputFullName").value.trim();
  const course = document.getElementById("inputCourse").value.trim();
  const semYear = document.getElementById("inputSemYear").value.trim();
  const listType = document.getElementById("inputListType").value;

  if (!fullName || !course || !semYear || !listType) {
    alert("Please fill in all fields.");
    return;
  }
  closeModal();
  generatePDF(fullName, course, semYear, listType);
}

function generatePDF(fullName, course, semYear, listType) {
  // 1) Compute GWA and determine badge note
  const gwaText = document.getElementById("gwaResult").innerText;
  const gwa = parseFloat((gwaText.match(/([\d.]+)/) || [])[1] || 0);
  let statusText, noteText;
  if (gwa <= 1.25) {
    statusText = "President’s Lister";
    noteText = "Note: President’s Lister Qualified.";
  } else if (gwa <= 1.75) {
    statusText = "Dean’s Lister";
    noteText = "Note: Dean’s Lister Qualified.";
  } else {
    statusText = "Not Qualified";
    noteText = "Note: Not Qualified This Sem.";
  }

  // 2) Play success/fail audio
  document
    .getElementById("successAudio")
    ?.play()
    .catch(() => {});
  if (statusText === "Not Qualified")
    document
      .getElementById("failAudio")
      ?.play()
      .catch(() => {});

  // 3) Temporarily expand your table so html2canvas sees all rows
  const container = document.getElementById("gwaContainer");
  const tableScroll = document.querySelector(".table-scroll");
  const oldMaxH = tableScroll.style.maxHeight;
  tableScroll.style.maxHeight = "unset";
  tableScroll.style.overflow = "visible";

  // 4) Preload banner
  const banner = new Image();
  banner.src = "banner.png"; // adjust path if needed
  banner.onload = () => {
    const pdfW = 612; // 8.5" × 72pt
    const bannerH = 1.2 * 72; // 1.2" × 72pt ≈ 86.4pt
    const headerY = bannerH + 30; // where note goes

    setTimeout(() => {
      html2canvas(container, {
        scale: 2,
        useCORS: true,
        scrollY: -window.scrollY,
        windowHeight: container.scrollHeight,
      }).then((canvas) => {
        // restore scrolling
        tableScroll.style.maxHeight = oldMaxH || "300px";
        tableScroll.style.overflow = "auto";

        // screenshot → image data
        const imgData = canvas.toDataURL("image/png");
        const { jsPDF } = window.jspdf;
        const tmpPdf = new jsPDF();
        const props = tmpPdf.getImageProperties(imgData);
        const imgH = (props.height * pdfW) / props.width;
        const pdfH = bannerH + 80 + imgH; // 80 for note & spacing

        // 5) Create final PDF
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "pt",
          format: [pdfW, pdfH],
        });

        // draw banner
        pdf.addImage(banner, "PNG", 0, 0, pdfW, bannerH);

        // overlay white text, two cols
        pdf.setFont("helvetica", "bold").setFontSize(12).setTextColor("#fff");
        const leftX = 40;
        const rightX = pdfW / 2 + 20;
        const baseY = bannerH / 2 - 18;
        const gapY = 16;

        // labels
        pdf.text("Name:", leftX, baseY);
        pdf.text("Course:", leftX, baseY + gapY);
        pdf.text("Year/Sem:", leftX, baseY + 2 * gapY);
        pdf.text("Application:", leftX, baseY + 3 * gapY);

        // values
        pdf.setFont("helvetica", "normal");
        pdf.text(fullName, rightX, baseY);
        pdf.text(course, rightX, baseY + gapY);
        pdf.text(semYear, rightX, baseY + 2 * gapY);
        pdf.text(listType, rightX, baseY + 3 * gapY);

        // 6) Draw red note right below
        pdf
          .setFont("helvetica", "bold")
          .setFontSize(12)
          .setTextColor("#b30000");
        pdf.text(noteText, leftX, bannerH + 20);

        // 7) Draw the full screenshot below
        pdf.addImage(imgData, "PNG", 0, headerY, pdfW, imgH);

        // —— 8) Add vertical watermark down each side ——
        pdf
          .setFont("helvetica", "italic")
          .setFontSize(8)
          .setTextColor("#999999");
        const midY = pdf.internal.pageSize.getHeight() / 2;

        // left margin, rotated 90°
        pdf.text("generated from lazydevcalculator", 10, midY, { angle: 90 });

        // right margin, rotated -90°
        const pageWidth = pdf.internal.pageSize.getWidth();
        pdf.text("generated from lazydevcalculator", pageWidth - 10, midY, {
          angle: -90,
        });

        // —— 9) Save the PDF ——
        const filename = `${course}, ${fullName} - GWA.pdf`;
        pdf.save(filename);
      });
    }, 100);
  };

  banner.onerror = () => {
    alert("Could not load banner.png – please check the path/filename.");
    tableScroll.style.maxHeight = oldMaxH || "300px";
    tableScroll.style.overflow = "auto";
  };
}

function downloadAsImage() {
  const container = document.getElementById("gwaContainer");
  const tableScroll = document.querySelector(".table-scroll");

  // Step 1: Temporarily expand scrollable area to fit content
  const originalMaxHeight = tableScroll.style.maxHeight;
  tableScroll.style.maxHeight = "unset";
  tableScroll.style.overflow = "visible";

  // Step 2: Wait for layout to adjust before capture
  setTimeout(() => {
    html2canvas(container, {
      scale: 2,
      useCORS: true,
      scrollY: -window.scrollY,
      windowHeight: container.scrollHeight,
    }).then((canvas) => {
      // Step 3: Restore original style
      tableScroll.style.maxHeight = originalMaxHeight || "300px";
      tableScroll.style.overflow = "auto";

      // Step 4: Save image
      const link = document.createElement("a");
      link.download = "follow-vinceramirez.jpg";
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
    });
  }, 100); // slight delay to allow reflow
}
