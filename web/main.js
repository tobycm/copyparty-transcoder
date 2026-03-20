const API_ENDPOINT = "/transcode";

/**
 * @type {HTMLInputElement}
 */
const pathInput = document.getElementById("path");
/**
 * @type {HTMLInputElement}
 */
const passwordInput = document.getElementById("password");
/**
 * @type {HTMLInputElement}
 */
const reencodeCheckbox = document.getElementById("reencode");
/**
 * @type {HTMLInputElement}
 */
const submitButton = document.getElementById("submit");

submitButton.addEventListener("click", async () => {
  const path = pathInput.value;

  const url = new URL(path);

  const password = passwordInput.value;
  const reencode = reencodeCheckbox.checked;

  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${password}`,
    },
    body: JSON.stringify({
      filepath: url.pathname,
      reencode,
    }),
  });

  const result = await response.json();
  console.log(result);
});
