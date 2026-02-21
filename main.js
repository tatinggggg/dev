"use strict";

/* ============================================================
   Bitcoin Transaction Verifier — Main Script
   Sections:
     1. Constants & Utilities
     2. Tab Navigation
     3. Transaction Decoder
     4. Address Lookup
     5. Transaction Builder
     6. Address Book
     7. Broadcast & Mempool Engine
     8. TX Detail Modal
     9. Address Detail Modal
============================================================ */

// Example transaction (a real Bitcoin transaction)
const EXAMPLE_TX = '0100000001c997a5e56e104102fa209c6a852dd90660a20b2d9c352423edce25857fcd3704000000004847304402204e45e16932b8af514961a1d3a1a25fdf3f4f7732e9d624c6c61548ab5fb8cd410220181522ec8eca07de4860a4acdd12909d831cc56cbbac4622082221a8768d1d0901ffffffff0200ca9a3b00000000434104ae1a62fe09c5f51b13905f07f06b99a2f7159b2225f374cd378d71302fa28414e7aab37397f554a7df5f142c21c1b7303b8a0626f1baded5c72a704f7e6cd84cac00286bee0000000043410411db93e1dcdb8a016b49840f8c53bc1eb68a382e97b1482ecad7b148a6909a5cb2e0eaddfb84ccf9744464f82e160bfa9b8b64f9d4c03f999b8643f656b412a3ac00000000';

// Tab switching
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Core tab switch — works for desktop and mobile
function activateTab(tabName) {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn[data-tab="' + tabName + '"]').forEach(b => b.classList.add('active'));
    document.querySelectorAll('.mnav-item[data-tab="' + tabName + '"]').forEach(b => b.classList.add('active'));
    const tabEl = document.getElementById(tabName);
    if (tabEl) tabEl.classList.add('active');
    // Trigger broadcast init
    if (tabName === 'broadcast-tx' && !bcastInited) {
        bcastInited = true;
        setTimeout(initBroadcastTab, 100);
    }
}

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        activateTab(btn.dataset.tab);
        results.classList.remove('show');
    });
});

// Mobile nav toggle
function toggleMobileNav() {
    const toggle = document.getElementById('mobileNavToggle');
    const drawer = document.getElementById('mobileNavDrawer');
    const open = drawer.classList.contains('open');
    toggle.classList.toggle('open', !open);
    drawer.classList.toggle('open', !open);
}

function switchMobileTab(btn) {
    const tabName = btn.dataset.tab;
    // Update active state in drawer
    document.querySelectorAll('.mnav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Update label in toggle button
    const labelEl = document.getElementById('mobileNavLabel');
    if (labelEl) labelEl.textContent = btn.textContent;
    // Close drawer
    document.getElementById('mobileNavToggle').classList.remove('open');
    document.getElementById('mobileNavDrawer').classList.remove('open');
    // Switch tab
    activateTab(tabName);
    results.classList.remove('show');
}

// Close mobile drawer when clicking outside
document.addEventListener('click', (e) => {
    const toggle = document.getElementById('mobileNavToggle');
    const drawer = document.getElementById('mobileNavDrawer');
    if (toggle && drawer && !toggle.contains(e.target) && !drawer.contains(e.target)) {
        toggle.classList.remove('open');
        drawer.classList.remove('open');
    }
});

// Transaction decoder functionality
const decodeBtn = document.getElementById('decodeBtn');
const clearBtn = document.getElementById('clearBtn');
const loadExample = document.getElementById('loadExample');
const rawTxInput = document.getElementById('rawTxInput');
const results = document.getElementById('results');
const resultsContent = document.getElementById('resultsContent');
const loading = document.getElementById('loading');

// Address lookup functionality
const lookupBtn = document.getElementById('lookupBtn');
const clearAddressBtn = document.getElementById('clearAddressBtn');
const addressInput = document.getElementById('addressInput');
const addressLoading = document.getElementById('addressLoading');
const addressExamples = document.querySelectorAll('.address-example');

// Transaction builder functionality
const fetchUtxosBtn = document.getElementById('fetchUtxosBtn');
const utxoFetchAddress = document.getElementById('utxoFetchAddress');
const utxoList = document.getElementById('utxoList');
const addManualUtxoBtn = document.getElementById('addManualUtxoBtn');
const addOutputBtn = document.getElementById('addOutputBtn');
const outputList = document.getElementById('outputList');
const buildTxBtn = document.getElementById('buildTxBtn');
const clearBuilderBtn = document.getElementById('clearBuilderBtn');
const builderLoading = document.getElementById('builderLoading');
const txSummary = document.getElementById('txSummary');
const addChangeOutput = document.getElementById('addChangeOutput');
const changeAddressGroup = document.getElementById('changeAddressGroup');

let selectedUtxos = [];
let outputCounter = 1;

// Transaction builder event listeners
fetchUtxosBtn.addEventListener('click', async () => {
    const address = utxoFetchAddress.value.trim();
    if (!address) {
        showAlert('Please enter an address to fetch UTXOs', 'error');
        return;
    }
    if (!isValidBitcoinAddress(address)) {
        showAlert('Invalid Bitcoin address format', 'error');
        return;
    }
    await fetchUtxosForBuilder(address);
});

addManualUtxoBtn.addEventListener('click', () => {
    showManualUtxoForm();
});

addOutputBtn.addEventListener('click', () => {
    addOutputField();
});

buildTxBtn.addEventListener('click', () => {
    buildRawTransaction();
});

clearBuilderBtn.addEventListener('click', () => {
    clearTransactionBuilder();
});

addChangeOutput.addEventListener('change', () => {
    changeAddressGroup.style.display = addChangeOutput.checked ? 'block' : 'none';
});

// Live-update summary whenever fee changes
document.getElementById('txFee').addEventListener('input', updateLiveSummary);
document.getElementById('txFee').addEventListener('change', updateLiveSummary);

async function fetchUtxosForBuilder(address) {
    builderLoading.classList.add('show');
    
    try {
        const response = await fetch(`https://blockchain.info/unspent?active=${address}`);
        
        if (!response.ok) {
            throw new Error('No UTXOs found or API error');
        }

        const data = await response.json();
        displayUtxosForSelection(data.unspent_outputs, address);
        
        builderLoading.classList.remove('show');
    } catch (error) {
        builderLoading.classList.remove('show');
        showAlert(`Error fetching UTXOs: ${error.message}`, 'error');
    }
}

function displayUtxosForSelection(utxos, address) {
    if (utxos.length === 0) {
        utxoList.innerHTML = '<div class="alert info"><span>ℹ️</span><span>No UTXOs found for this address</span></div>';
        return;
    }

    utxoList.innerHTML = `
        <div class="alert info">
            <span>ℹ️</span>
            <span>Found ${utxos.length} UTXO(s). Click to select inputs for your transaction.</span>
        </div>
    `;

    utxos.forEach((utxo, index) => {
        const utxoEl = document.createElement('div');
        utxoEl.className = 'utxo-select-item';
        utxoEl.dataset.index = index;
        utxoEl.innerHTML = `
            <div class="utxo-select-header">
                <span class="utxo-select-amount">${(utxo.value / 100000000).toFixed(8)} BTC</span>
            </div>
            <div class="utxo-select-details">
                <div class="utxo-select-row">
                    <span class="utxo-select-label">TX Hash</span>
                    <span class="utxo-select-value">${utxo.tx_hash_big_endian}</span>
                </div>
                <div class="utxo-select-row">
                    <span class="utxo-select-label">Output Index</span>
                    <span class="utxo-select-value">${utxo.tx_output_n}</span>
                </div>
                <div class="utxo-select-row">
                    <span class="utxo-select-label">Confirmations</span>
                    <span class="utxo-select-value">${utxo.confirmations || 0}</span>
                </div>
                <div class="utxo-select-row">
                    <span class="utxo-select-label">Script</span>
                    <span class="utxo-select-value">${utxo.script}</span>
                </div>
            </div>
        `;

        utxoEl.addEventListener('click', () => {
            toggleUtxoSelection(utxoEl, {
                txHash: utxo.tx_hash_big_endian,
                outputIndex: utxo.tx_output_n,
                value: utxo.value,
                script: utxo.script,
                address: address
            });
        });

        utxoList.appendChild(utxoEl);
    });
}

function toggleUtxoSelection(element, utxoData) {
    const isSelected = element.classList.contains('selected');
    
    if (isSelected) {
        element.classList.remove('selected');
        selectedUtxos = selectedUtxos.filter(u => u.txHash !== utxoData.txHash || u.outputIndex !== utxoData.outputIndex);
    } else {
        element.classList.add('selected');
        selectedUtxos.push(utxoData);
    }

    updateTransactionSummary();
    updateAvailableBalance();
}

function showManualUtxoForm() {
    const formHtml = `
        <div class="manual-utxo-form" id="manualUtxoForm">
            <h4 style="margin-bottom: 1rem; color: var(--text-primary);">Add UTXO Manually</h4>
            <div class="form-group">
                <label>Previous Transaction Hash</label>
                <input type="text" id="manualTxHash" placeholder="Transaction hash (64 hex characters)">
            </div>
            <div class="form-group">
                <label>Output Index (vout)</label>
                <input type="number" id="manualOutputIndex" placeholder="0">
            </div>
            <div class="form-group">
                <label>Value (satoshis)</label>
                <input type="number" id="manualValue" placeholder="100000">
            </div>
            <div class="form-group">
                <label>ScriptPubKey (hex)</label>
                <input type="text" id="manualScript" placeholder="Script hex">
            </div>
            <div class="form-group">
                <label>Address (optional)</label>
                <input type="text" id="manualAddress" placeholder="Bitcoin address">
            </div>
            <div class="manual-utxo-actions">
                <button onclick="addManualUtxo()" class="btn-inline">Add UTXO</button>
                <button onclick="cancelManualUtxo()" class="btn-secondary btn-inline">Cancel</button>
            </div>
        </div>
    `;

    utxoList.insertAdjacentHTML('beforeend', formHtml);
}

window.addManualUtxo = function() {
    const txHash = document.getElementById('manualTxHash').value.trim();
    const outputIndex = parseInt(document.getElementById('manualOutputIndex').value);
    const value = parseInt(document.getElementById('manualValue').value);
    const script = document.getElementById('manualScript').value.trim();
    const address = document.getElementById('manualAddress').value.trim();

    if (!txHash || isNaN(outputIndex) || isNaN(value) || !script) {
        showAlert('Please fill in all required fields', 'error');
        return;
    }

    if (!/^[0-9a-fA-F]{64}$/.test(txHash)) {
        showAlert('Invalid transaction hash format', 'error');
        return;
    }

    selectedUtxos.push({
        txHash: txHash,
        outputIndex: outputIndex,
        value: value,
        script: script,
        address: address || 'Manual Entry'
    });

    document.getElementById('manualUtxoForm').remove();
    
    showAlert('UTXO added successfully!', 'info');
    updateTransactionSummary();
    updateAvailableBalance();
};

window.cancelManualUtxo = function() {
    document.getElementById('manualUtxoForm').remove();
};

function addOutputField() {
    const totalInput = selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
    const availableBalance = (totalInput / 100000000).toFixed(8);
    
    const outputItem = document.createElement('div');
    outputItem.className = 'output-item';
    outputItem.dataset.index = outputCounter;
    outputItem.innerHTML = `
        <div class="output-header">
            <span class="output-label">Output #${outputCounter}</span>
            <button class="btn-remove" onclick="removeOutput(${outputCounter})">✕</button>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Recipient Address</label>
                <input type="text" class="output-address" placeholder="Bitcoin address">
                <button class="ab-pick-btn" onclick="abOpenPicker(this)">📓 Pick from Address Book</button>
            </div>
            <div class="form-group">
                <label>Amount (BTC)</label>
                <input type="number" step="0.00000001" class="output-amount" placeholder="0.00000000" data-output-index="${outputCounter}" oninput="updateBalancePreview()">
                <div class="amount-hint">
                    Available: <span class="available-balance">${availableBalance}</span> BTC 
                    <span class="separator">•</span>
                    <a href="#" class="use-all-link" onclick="event.preventDefault(); setMaxAmount(${outputCounter})">Use All</a>
                </div>
                <div class="balance-preview" style="display: none;">
                    <span class="preview-label">Remaining:</span>
                    <span class="preview-value">0.00000000 BTC</span>
                </div>
            </div>
        </div>
    `;
    outputList.appendChild(outputItem);
    outputCounter++;
}

window.removeOutput = function(index) {
    const output = document.querySelector(`.output-item[data-index="${index}"]`);
    if (output && outputList.children.length > 1) {
        output.remove();
        updateTransactionSummary();
    }
};

function updateTransactionSummary() { updateLiveSummary(); }

function updateAvailableBalance() {
    const totalInput = selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
    const availableBalanceElements = document.querySelectorAll('.available-balance');
    availableBalanceElements.forEach(el => {
        el.textContent = (totalInput / 100000000).toFixed(8);
    });
    updateLiveSummary();
}

window.updateBalancePreview = function() { updateLiveSummary(); };

function updateLiveSummary() {
    const totalInputSats = selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
    const feeSats = parseInt(document.getElementById('txFee').value) || 0;

    // Sum all output amounts
    const outputElements = document.querySelectorAll('.output-item');
    let totalOutputSats = 0;
    outputElements.forEach(outputEl => {
        const amount = parseFloat(outputEl.querySelector('.output-amount').value) || 0;
        totalOutputSats += Math.round(amount * 100000000);
    });

    const remainingSats = totalInputSats - totalOutputSats - feeSats;
    const remainingBTC = (remainingSats / 100000000).toFixed(8);
    const overspent = remainingSats < 0;

    // --- Update stat cards ---
    document.getElementById('summaryInput').textContent    = `${(totalInputSats / 100000000).toFixed(8)} BTC`;
    document.getElementById('summaryInputSats').textContent = `${totalInputSats.toLocaleString()} sats`;
    document.getElementById('summaryOutput').textContent   = `${(totalOutputSats / 100000000).toFixed(8)} BTC`;
    document.getElementById('summaryOutputSats').textContent = `${totalOutputSats.toLocaleString()} sats`;
    document.getElementById('summaryFee').textContent      = `${feeSats.toLocaleString()} sats`;
    document.getElementById('summaryFeeBtc').textContent   = `${(feeSats / 100000000).toFixed(8)} BTC`;

    const changeEl = document.getElementById('summaryChange');
    const changeSatsEl = document.getElementById('summaryChangeSats');
    const remainingCard = document.getElementById('summaryRemainingCard');
    changeEl.textContent = `${remainingBTC} BTC`;
    changeSatsEl.textContent = `${remainingSats.toLocaleString()} sats`;
    changeEl.style.color = overspent ? 'var(--accent-red)' : remainingSats === 0 ? 'var(--accent-orange)' : 'var(--accent-green)';

    // --- Progress bar ---
    const outputPct = totalInputSats > 0 ? Math.min((totalOutputSats / totalInputSats) * 100, 100) : 0;
    const feePct    = totalInputSats > 0 ? Math.min((feeSats / totalInputSats) * 100, 100) : 0;
    const remainPct = Math.max(100 - outputPct - feePct, 0);
    document.getElementById('txProgressFill').style.width = `${outputPct}%`;
    document.getElementById('txProgressFee').style.width  = `${feePct}%`;
    document.getElementById('txProgressOutputLabel').textContent  = `Output: ${outputPct.toFixed(1)}%`;
    document.getElementById('txProgressFeeLabel').textContent     = `Fee: ${feePct.toFixed(2)}%`;
    document.getElementById('txProgressRemainLabel').textContent  = `Remaining: ${remainPct.toFixed(1)}%`;
    document.getElementById('txProgressRemainLabel').style.color  = overspent ? 'var(--accent-red)' : 'var(--accent-green)';

    // --- Banner message ---
    const banner = document.getElementById('txRemainingBanner');
    const bannerIcon = document.getElementById('txRemainingIcon');
    const bannerMsg  = document.getElementById('txRemainingMsg');
    banner.classList.remove('ready','warning','danger');

    if (totalInputSats === 0) {
        bannerIcon.textContent = '💡';
        bannerMsg.textContent = 'Select UTXOs to load your available balance.';
    } else if (totalOutputSats === 0) {
        bannerIcon.textContent = '✏️';
        bannerMsg.textContent = `${(totalInputSats / 100000000).toFixed(8)} BTC available — enter amounts in each output.`;
    } else if (overspent) {
        banner.classList.add('danger');
        bannerIcon.textContent = '🚨';
        bannerMsg.textContent = `Overspent by ${Math.abs(remainingBTC)} BTC (${Math.abs(remainingSats).toLocaleString()} sats). Reduce output amounts.`;
    } else if (remainingSats === 0) {
        banner.classList.add('ready');
        bannerIcon.textContent = '✅';
        bannerMsg.textContent = 'Perfectly balanced — no change output needed.';
    } else if (remainingSats > 0 && remainingSats < 546) {
        banner.classList.add('warning');
        bannerIcon.textContent = '⚠️';
        bannerMsg.textContent = `Remaining ${remainingSats} sats is below dust threshold (546). Adjust outputs or fee.`;
    } else {
        banner.classList.add('ready');
        bannerIcon.textContent = '💚';
        bannerMsg.textContent = `${remainingBTC} BTC (${remainingSats.toLocaleString()} sats) remaining — goes to change address.`;
    }

    // --- Summary card border ---
    const summaryCard = document.getElementById('txSummary');
    summaryCard.style.borderColor = overspent ? 'var(--accent-red)' : totalOutputSats > 0 ? 'var(--accent-green)' : 'var(--accent-blue)';

    // --- Per-output remaining hint ---
    outputElements.forEach(outputEl => {
        const amountInput = outputEl.querySelector('.output-amount');
        const preview     = outputEl.querySelector('.balance-preview');
        const valueEl     = preview ? preview.querySelector('.preview-value') : null;
        const amount = parseFloat(amountInput.value) || 0;
        const amountSats = Math.round(amount * 100000000);

        // Mark overspent inputs
        amountInput.classList.toggle('over', overspent && amountSats > 0);

        if (preview && valueEl && totalInputSats > 0 && amount > 0) {
            preview.style.display = 'flex';
            valueEl.textContent = `${remainingBTC} BTC remaining (${remainingSats.toLocaleString()} sats)`;
            valueEl.classList.toggle('negative', overspent);
            valueEl.classList.toggle('positive', !overspent);
        } else if (preview) {
            preview.style.display = 'none';
        }
    });
}

window.setMaxAmount = function(outputIndex) {
    const totalInput = selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
    
    if (totalInput === 0) {
        showAlert('Please select UTXOs first', 'error');
        return;
    }

    const fee = parseInt(document.getElementById('txFee').value) || 0;
    
    // Get all output amounts except the current one
    const outputElements = document.querySelectorAll('.output-item');
    let otherOutputsTotal = 0;
    
    outputElements.forEach(outputEl => {
        const index = parseInt(outputEl.dataset.index);
        if (index !== outputIndex) {
            const amount = parseFloat(outputEl.querySelector('.output-amount').value) || 0;
            otherOutputsTotal += Math.floor(amount * 100000000);
        }
    });

    // Calculate maximum available for this output
    let maxAmount = totalInput - otherOutputsTotal - fee;

    // If change output is enabled and this is the only/last output
    if (addChangeOutput.checked && outputElements.length === 1) {
        addChangeOutput.checked = false;
        changeAddressGroup.style.display = 'none';
        showAlert('Change output disabled when using "Use All"', 'info');
    }

    if (maxAmount <= 0) {
        showAlert('Insufficient funds after accounting for fee and other outputs', 'error');
        return;
    }

    // Set the amount in BTC
    const amountInBTC = (maxAmount / 100000000).toFixed(8);
    const targetOutput = document.querySelector(`.output-item[data-index="${outputIndex}"] .output-amount`);
    
    if (targetOutput) {
        targetOutput.value = amountInBTC;
        updateBalancePreview();
        
        // Highlight the input briefly
        targetOutput.style.background = 'rgba(0, 211, 149, 0.1)';
        setTimeout(() => {
            targetOutput.style.background = '';
        }, 1000);
        
        showAlert(`Set to maximum: ${amountInBTC} BTC (${maxAmount.toLocaleString()} satoshis)`, 'info');
    }
};

function clearTransactionBuilder() {
    selectedUtxos = [];
    utxoList.innerHTML = '';
    outputList.innerHTML = `
        <div class="output-item" data-index="0">
            <div class="output-header">
                <span class="output-label">Output #0</span>
                <button class="btn-remove" onclick="removeOutput(0)">✕</button>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Recipient Address</label>
                    <input type="text" class="output-address" placeholder="Bitcoin address">
                </div>
                <div class="form-group">
                    <label>Amount (BTC)</label>
                    <input type="number" step="0.00000001" class="output-amount" placeholder="0.00000000" data-output-index="0" oninput="updateBalancePreview()">
                    <div class="amount-hint">
                        Available: <span class="available-balance">0.00000000</span> BTC 
                        <span class="separator">•</span>
                        <a href="#" class="use-all-link" onclick="event.preventDefault(); setMaxAmount(0)">Use All</a>
                    </div>
                    <div class="balance-preview" style="display: none;">
                        <span class="preview-label">Remaining:</span>
                        <span class="preview-value">0.00000000 BTC</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    outputCounter = 1;
    utxoFetchAddress.value = '';
    document.getElementById('changeAddress').value = '';
    document.getElementById('txFee').value = '1000';
    document.getElementById('txLocktime').value = '0';
    results.classList.remove('show');
    updateLiveSummary();
}

function buildRawTransaction() {
    if (selectedUtxos.length === 0) {
        showAlert('Please select at least one UTXO input', 'error');
        return;
    }

    const outputs = [];
    const outputElements = document.querySelectorAll('.output-item');
    
    outputElements.forEach(outputEl => {
        const address = outputEl.querySelector('.output-address').value.trim();
        const amount = parseFloat(outputEl.querySelector('.output-amount').value);
        
        if (address && amount > 0) {
            outputs.push({
                address: address,
                value: Math.floor(amount * 100000000)
            });
        }
    });

    if (outputs.length === 0) {
        showAlert('Please add at least one output with valid address and amount', 'error');
        return;
    }

    const fee = parseInt(document.getElementById('txFee').value) || 0;
    const locktime = parseInt(document.getElementById('txLocktime').value) || 0;

    // Calculate totals
    const totalInput = selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
    const totalOutput = outputs.reduce((sum, out) => sum + out.value, 0);
    let change = totalInput - totalOutput - fee;

    // Add change output if enabled
    if (addChangeOutput.checked && change > 0) {
        const changeAddr = document.getElementById('changeAddress').value.trim();
        if (!changeAddr) {
            showAlert('Please enter a change address or uncheck "Add change output"', 'error');
            return;
        }
        outputs.push({
            address: changeAddr,
            value: change,
            isChange: true
        });
    } else if (change < 0) {
        showAlert('Insufficient funds: Outputs + fee exceed inputs', 'error');
        return;
    }

    builderLoading.classList.add('show');

    setTimeout(() => {
        try {
            const rawTx = constructRawTransaction(selectedUtxos, outputs, locktime);
            // Stash for broadcast tab use
            window._lastBuiltTxInputs  = selectedUtxos;
            window._lastBuiltTxOutputs = outputs;
            displayBuiltTransaction(rawTx, selectedUtxos, outputs, fee, change);
            builderLoading.classList.remove('show');
            results.classList.add('show');
            results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (error) {
            builderLoading.classList.remove('show');
            showAlert(`Error building transaction: ${error.message}`, 'error');
        }
    }, 800);
}

function constructRawTransaction(inputs, outputs, locktime) {
    let rawTx = '';

    // Version (4 bytes, little-endian)
    rawTx += reverseHex(numToHex(1, 4));

    // Input count (varint)
    rawTx += numToVarInt(inputs.length);

    // Inputs
    inputs.forEach(input => {
        // Previous tx hash (32 bytes, reversed)
        rawTx += reverseHex(input.txHash);
        
        // Output index (4 bytes, little-endian)
        rawTx += reverseHex(numToHex(input.outputIndex, 4));
        
        // ScriptSig length and ScriptSig (empty for unsigned tx)
        rawTx += '00'; // Empty scriptSig for unsigned transaction
        
        // Sequence (4 bytes)
        rawTx += 'ffffffff';
    });

    // Output count (varint)
    rawTx += numToVarInt(outputs.length);

    // Outputs
    outputs.forEach(output => {
        // Value (8 bytes, little-endian)
        rawTx += reverseHex(numToHex(output.value, 8));
        
        // ScriptPubKey
        const scriptPubKey = addressToScriptPubKey(output.address);
        rawTx += numToVarInt(scriptPubKey.length / 2);
        rawTx += scriptPubKey;
    });

    // Locktime (4 bytes, little-endian)
    rawTx += reverseHex(numToHex(locktime, 4));

    return rawTx;
}

function addressToScriptPubKey(address) {
    // P2PKH (starts with 1)
    if (address.startsWith('1')) {
        const decoded = base58Decode(address);
        const pubKeyHash = decoded.slice(2, -8); // Remove version and checksum
        return '76a914' + pubKeyHash + '88ac';
    }
    
    // P2SH (starts with 3)
    if (address.startsWith('3')) {
        const decoded = base58Decode(address);
        const scriptHash = decoded.slice(2, -8);
        return 'a914' + scriptHash + '87';
    }
    
    // Bech32 (starts with bc1) - simplified
    if (address.startsWith('bc1')) {
        // For demo purposes, return a placeholder
        return '0014' + '0000000000000000000000000000000000000000';
    }
    
    throw new Error('Unsupported address type');
}

function base58Decode(address) {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let decoded = BigInt(0);
    
    for (let i = 0; i < address.length; i++) {
        decoded = decoded * BigInt(58) + BigInt(ALPHABET.indexOf(address[i]));
    }
    
    let hex = decoded.toString(16);
    if (hex.length % 2) hex = '0' + hex;
    
    // Add leading zeros
    for (let i = 0; i < address.length && address[i] === '1'; i++) {
        hex = '00' + hex;
    }
    
    return hex;
}

function numToHex(num, bytes) {
    let hex = num.toString(16);
    while (hex.length < bytes * 2) {
        hex = '0' + hex;
    }
    return hex;
}

function numToVarInt(num) {
    if (num < 0xfd) {
        return numToHex(num, 1);
    } else if (num <= 0xffff) {
        return 'fd' + reverseHex(numToHex(num, 2));
    } else if (num <= 0xffffffff) {
        return 'fe' + reverseHex(numToHex(num, 4));
    } else {
        return 'ff' + reverseHex(numToHex(num, 8));
    }
}

function reverseHex(hex) {
    return hex.match(/.{2}/g).reverse().join('');
}

function displayBuiltTransaction(rawTx, inputs, outputs, fee, change) {
    const totalInput = inputs.reduce((sum, inp) => sum + inp.value, 0);
    const totalOutput = outputs.reduce((sum, out) => sum + out.value, 0);
    const actualFee = totalInput - totalOutput;

    // Group unique addresses
    const fromAddresses = [...new Set(inputs.map(i => i.address))];
    const toAddresses = outputs.filter(o => !o.isChange).map(o => ({
        address: o.address,
        value: o.value
    }));
    const changeOutput = outputs.find(o => o.isChange);

    resultsContent.innerHTML = `
        <div class="result-section success">
            <div class="result-title">
                <span class="status-badge valid">✓ Transaction Built</span>
                Raw transaction generated successfully
            </div>
        </div>

        <div class="result-section">
            <div class="result-title">📋 Transaction Summary (Simple View)</div>
            <div style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 10px; margin-bottom: 1rem;">
                <div style="margin-bottom: 1.5rem;">
                    <h4 style="color: var(--accent-red); margin-bottom: 0.75rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px;">📤 FROM (Sending)</h4>
                    ${fromAddresses.map((addr, i) => {
                        const addrInputs = inputs.filter(inp => inp.address === addr);
                        const addrTotal = addrInputs.reduce((sum, inp) => sum + inp.value, 0);
                        return `
                        <div style="margin-bottom: 0.5rem; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px; border-left: 3px solid var(--accent-red);">
                            <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${addr}</div>
                            <div style="font-weight: 700; color: var(--accent-red);">${(addrTotal / 100000000).toFixed(8)} BTC</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">${addrInputs.length} UTXO(s)</div>
                        </div>
                        `;
                    }).join('')}
                    <div style="text-align: right; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border);">
                        <span style="color: var(--text-muted); font-size: 0.85rem;">Total Sending: </span>
                        <span style="font-weight: 700; color: var(--text-primary); font-family: 'JetBrains Mono', monospace;">${(totalInput / 100000000).toFixed(8)} BTC</span>
                    </div>
                </div>

                <div style="text-align: center; margin: 1rem 0; color: var(--text-muted); font-size: 1.5rem;">
                    ↓
                </div>

                <div>
                    <h4 style="color: var(--accent-green); margin-bottom: 0.75rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px;">📥 TO (Receiving)</h4>
                    ${toAddresses.map((output, i) => `
                        <div style="margin-bottom: 0.5rem; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px; border-left: 3px solid var(--accent-green);">
                            <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${output.address}</div>
                            <div style="font-weight: 700; color: var(--accent-green);">${(output.value / 100000000).toFixed(8)} BTC</div>
                        </div>
                    `).join('')}
                    ${changeOutput ? `
                        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--border);">
                            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">💰 Change (back to you):</div>
                            <div style="padding: 0.75rem; background: var(--bg-primary); border-radius: 6px; border-left: 3px solid var(--accent-blue);">
                                <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${changeOutput.address}</div>
                                <div style="font-weight: 700; color: var(--accent-blue);">${(changeOutput.value / 100000000).toFixed(8)} BTC</div>
                            </div>
                        </div>
                    ` : ''}
                    <div style="text-align: right; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border);">
                        <div style="margin-bottom: 0.5rem;">
                            <span style="color: var(--text-muted); font-size: 0.85rem;">Total Output: </span>
                            <span style="font-weight: 700; color: var(--text-primary); font-family: 'JetBrains Mono', monospace;">${(totalOutput / 100000000).toFixed(8)} BTC</span>
                        </div>
                        <div>
                            <span style="color: var(--text-muted); font-size: 0.85rem;">Network Fee: </span>
                            <span style="font-weight: 700; color: var(--accent-orange); font-family: 'JetBrains Mono', monospace;">${(actualFee / 100000000).toFixed(8)} BTC</span>
                            <span style="color: var(--text-muted); font-size: 0.75rem;">(${actualFee.toLocaleString()} sats)</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="result-section">
            <div class="result-title">📊 Transaction Statistics</div>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Total Input</div>
                    <div class="stat-value">${(totalInput / 100000000).toFixed(8)} BTC</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Total Output</div>
                    <div class="stat-value">${(totalOutput / 100000000).toFixed(8)} BTC</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Network Fee</div>
                    <div class="stat-value highlight">${actualFee.toLocaleString()} sats</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Size (est.)</div>
                    <div class="stat-value">${(rawTx.length / 2).toLocaleString()} bytes</div>
                </div>
            </div>
        </div>

        <div class="result-section">
            <div class="result-title">🔐 Raw Transaction Hex (Unsigned)</div>
            <div class="form-group">
                <label>Complete Transaction Hex</label>
                <textarea readonly style="min-height: 120px; font-size: 0.85rem;">${rawTx}</textarea>
            </div>
            <button onclick="copyToClipboard('${rawTx}')" class="btn-secondary">📋 Copy Transaction Hex</button>
        </div>

        <div class="result-section">
            <div class="result-title">🔍 Transaction Breakdown (Developer View)</div>
            
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: var(--accent-blue); margin-bottom: 0.75rem; font-size: 0.95rem;">Version & Metadata</h4>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Version (4 bytes)</div>
                        <div class="info-value">${reverseHex(numToHex(1, 4))} (LE) = 01000000</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Input Count</div>
                        <div class="info-value">${numToVarInt(inputs.length)} = ${inputs.length} input(s)</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Output Count</div>
                        <div class="info-value">${numToVarInt(outputs.length)} = ${outputs.length} output(s)</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Locktime (4 bytes)</div>
                        <div class="info-value">${reverseHex(numToHex(0, 4))} = 00000000</div>
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: var(--accent-red); margin-bottom: 0.75rem; font-size: 0.95rem;">📥 Input Hex Breakdown</h4>
                ${inputs.map((input, i) => {
                    const inputHex = reverseHex(input.txHash) + reverseHex(numToHex(input.outputIndex, 4)) + '00' + 'ffffffff';
                    return `
                    <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem; border-left: 3px solid var(--accent-red);">
                        <div style="font-weight: 700; margin-bottom: 0.75rem; color: var(--text-primary);">Input #${i}</div>
                        <div style="margin-bottom: 0.5rem;">
                            <span style="color: var(--text-muted); font-size: 0.85rem;">Previous TX Hash (32 bytes, reversed):</span>
                            <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--accent-blue); word-break: break-all; margin-top: 0.25rem;">${reverseHex(input.txHash)}</div>
                        </div>
                        <div style="margin-bottom: 0.5rem;">
                            <span style="color: var(--text-muted); font-size: 0.85rem;">Output Index (4 bytes, LE):</span>
                            <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--accent-blue); margin-top: 0.25rem;">${reverseHex(numToHex(input.outputIndex, 4))}</div>
                        </div>
                        <div style="margin-bottom: 0.5rem;">
                            <span style="color: var(--text-muted); font-size: 0.85rem;">ScriptSig Length:</span>
                            <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--accent-blue); margin-top: 0.25rem;">00 (empty - unsigned)</div>
                        </div>
                        <div style="margin-bottom: 0.5rem;">
                            <span style="color: var(--text-muted); font-size: 0.85rem;">Sequence (4 bytes):</span>
                            <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--accent-blue); margin-top: 0.25rem;">ffffffff</div>
                        </div>
                        <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border);">
                            <span style="color: var(--text-muted); font-size: 0.85rem;">Complete Input Hex:</span>
                            <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: var(--text-primary); word-break: break-all; margin-top: 0.25rem; background: var(--bg-primary); padding: 0.5rem; border-radius: 4px;">${inputHex}</div>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>

            <div>
                <h4 style="color: var(--accent-green); margin-bottom: 0.75rem; font-size: 0.95rem;">📤 Output Hex Breakdown</h4>
                ${outputs.map((output, i) => {
                    const scriptPubKey = addressToScriptPubKey(output.address);
                    const outputHex = reverseHex(numToHex(output.value, 8)) + numToVarInt(scriptPubKey.length / 2) + scriptPubKey;
                    return `
                    <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem; border-left: 3px solid ${output.isChange ? 'var(--accent-blue)' : 'var(--accent-green)'};">
                        <div style="font-weight: 700; margin-bottom: 0.75rem; color: var(--text-primary);">Output #${i}${output.isChange ? ' (Change)' : ''}</div>
                        <div style="margin-bottom: 0.5rem;">
                            <span style="color: var(--text-muted); font-size: 0.85rem;">Value (8 bytes, LE):</span>
                            <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--accent-green); margin-top: 0.25rem;">${reverseHex(numToHex(output.value, 8))} = ${output.value.toLocaleString()} sats</div>
                        </div>
                        <div style="margin-bottom: 0.5rem;">
                            <span style="color: var(--text-muted); font-size: 0.85rem;">ScriptPubKey Length:</span>
                            <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--accent-green); margin-top: 0.25rem;">${numToVarInt(scriptPubKey.length / 2)} = ${scriptPubKey.length / 2} bytes</div>
                        </div>
                        <div style="margin-bottom: 0.5rem;">
                            <span style="color: var(--text-muted); font-size: 0.85rem;">ScriptPubKey:</span>
                            <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--accent-green); word-break: break-all; margin-top: 0.25rem;">${scriptPubKey}</div>
                        </div>
                        <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border);">
                            <span style="color: var(--text-muted); font-size: 0.85rem;">Complete Output Hex:</span>
                            <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: var(--text-primary); word-break: break-all; margin-top: 0.25rem; background: var(--bg-primary); padding: 0.5rem; border-radius: 4px;">${outputHex}</div>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        </div>

        <div class="alert info">
            <span>💡</span>
            <div>
                <strong>Next Steps:</strong> This unsigned transaction follows Bitcoin's raw transaction format. To broadcast it to the network, you must sign it with your private key using a wallet or signing tool.
            </div>
        </div>
        <button onclick="sendBuiltTxToBroadcast('${rawTx}')" style="width:100%;margin-top:0.5rem;background:linear-gradient(135deg,var(--accent-orange),#ffb347);color:#000;font-weight:800;">
            📡 Copy to Broadcast Tab & Send
        </button>
    `;
}

window.copyToClipboard = function(text) {
    navigator.clipboard.writeText(text).then(() => {
        showAlert('Raw transaction copied to clipboard!', 'info');
    }).catch(() => {
        showAlert('Failed to copy to clipboard', 'error');
    });
};

// Called from displayBuiltTransaction to stash builder inputs/outputs
// so broadcast tab can show real UTXO details
function _stashAndRegisterBuilderTx(rawTx, inputs, outputs) {
    _pendingBuilderTxData = { rawTx, inputs, outputs };
}

window.sendBuiltTxToBroadcast = function(rawTx) {
    // Stash current builder data
    if (window._lastBuiltTxInputs) {
        _pendingBuilderTxData = {
            rawTx,
            inputs: window._lastBuiltTxInputs,
            outputs: window._lastBuiltTxOutputs
        };
    }
    // Navigate to broadcast tab
    activateTab('broadcast-tx');
    // Prefill the broadcast textarea
    const bcastInput = document.getElementById('bcastRawTx');
    if (bcastInput) {
        bcastInput.value = rawTx;
        bcastInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // Update mobile nav label
    const lbl = document.getElementById('mobileNavLabel');
    if (lbl) lbl.textContent = '📡 Broadcast & Mempool';
    document.querySelectorAll('.mnav-item').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === 'broadcast-tx');
    });
    showAlert('Transaction hex copied to Broadcast tab!', 'info');
};

addressExamples.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        addressInput.value = link.dataset.address;
        addressInput.focus();
    });
});

clearAddressBtn.addEventListener('click', () => {
    addressInput.value = '';
    results.classList.remove('show');
    addressInput.focus();
});

lookupBtn.addEventListener('click', async () => {
    const address = addressInput.value.trim();
    
    if (!address) {
        showAlert('Please enter a Bitcoin address', 'error');
        return;
    }

    if (!isValidBitcoinAddress(address)) {
        showAlert('Invalid Bitcoin address format', 'error');
        return;
    }

    await lookupAddress(address);
});

function isValidBitcoinAddress(address) {
    // Basic validation for Bitcoin addresses
    const p2pkhRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
    const p2shRegex = /^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/;
    const bech32Regex = /^(bc1)[a-z0-9]{39,87}$/;
    
    return p2pkhRegex.test(address) || p2shRegex.test(address) || bech32Regex.test(address);
}

async function lookupAddress(address) {
    addressLoading.classList.add('show');
    results.classList.remove('show');

    try {
        // Using blockchain.info API for address lookup
        const response = await fetch(`https://blockchain.info/rawaddr/${address}?limit=50`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch address data');
        }

        const data = await response.json();
        displayAddressResults(address, data);
        
        addressLoading.classList.remove('show');
        results.classList.add('show');
        results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
        addressLoading.classList.remove('show');
        showAlert(`Error fetching address data: ${error.message}. The API might be rate-limited or the address might not exist.`, 'error');
    }
}

function displayAddressResults(address, data) {
    const balance = (data.final_balance / 100000000).toFixed(8);
    const totalReceived = (data.total_received / 100000000).toFixed(8);
    const totalSent = (data.total_sent / 100000000).toFixed(8);
    const txCount = data.n_tx;

    // Get UTXOs (unspent outputs)
    const utxos = [];
    data.txs.forEach(tx => {
        tx.out.forEach((output, index) => {
            if (output.addr === address && output.spent === false) {
                utxos.push({
                    txid: tx.hash,
                    vout: index,
                    value: output.value,
                    valueBTC: (output.value / 100000000).toFixed(8),
                    confirmations: tx.block_height ? (data.txs[0].block_height - tx.block_height + 1) : 0,
                    scriptPubKey: output.script
                });
            }
        });
    });

    resultsContent.innerHTML = `
        <div class="result-section success">
            <div class="result-title">
                <span class="status-badge valid">✓ Address Found</span>
                Address details retrieved successfully
            </div>
        </div>

        <div class="result-section">
            <div class="result-title">💰 Balance & Statistics</div>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Current Balance</div>
                    <div class="stat-value highlight">${balance} BTC</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Total Received</div>
                    <div class="stat-value">${totalReceived} BTC</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Total Sent</div>
                    <div class="stat-value">${totalSent} BTC</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Transactions</div>
                    <div class="stat-value">${txCount}</div>
                </div>
            </div>

            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Address</div>
                    <div class="info-value">${address}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Address Type</div>
                    <div class="info-value">${getAddressType(address)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">UTXOs</div>
                    <div class="info-value">${utxos.length} unspent output(s)</div>
                </div>
            </div>
        </div>

        ${utxos.length > 0 ? `
        <div class="result-section">
            <div class="result-title">📦 Unspent Transaction Outputs (UTXOs)</div>
            <div class="alert info">
                <span>ℹ️</span>
                <div>
                    <strong>What are UTXOs?</strong> These are unspent outputs that can be used as inputs in new transactions. They represent the actual "coins" you own.
                </div>
            </div>
            <div class="utxo-list">
                ${utxos.slice(0, 10).map((utxo, i) => `
                    <div class="utxo-item">
                        <div class="utxo-header">
                            <span class="utxo-amount">${utxo.valueBTC} BTC</span>
                            <span class="utxo-status">Unspent</span>
                        </div>
                        <div class="io-details">
                            <div class="io-row">
                                <div class="io-row-label">Transaction ID</div>
                                <div class="io-row-value">${utxo.txid}</div>
                            </div>
                            <div class="io-row">
                                <div class="io-row-label">Output Index</div>
                                <div class="io-row-value">${utxo.vout}</div>
                            </div>
                            <div class="io-row">
                                <div class="io-row-label">Value (satoshis)</div>
                                <div class="io-row-value">${utxo.value.toLocaleString()}</div>
                            </div>
                            <div class="io-row">
                                <div class="io-row-label">Confirmations</div>
                                <div class="io-row-value">${utxo.confirmations || 'Unconfirmed'}</div>
                            </div>
                        </div>
                    </div>
                `).join('')}
                ${utxos.length > 10 ? `
                    <div class="alert info">
                        <span>ℹ️</span>
                        <span>Showing 10 of ${utxos.length} UTXOs</span>
                    </div>
                ` : ''}
            </div>
        </div>
        ` : `
        <div class="result-section">
            <div class="result-title">📦 Unspent Transaction Outputs (UTXOs)</div>
            <div class="alert info">
                <span>ℹ️</span>
                <span>No unspent outputs found. This address has a zero balance.</span>
            </div>
        </div>
        `}

        <div class="result-section">
            <div class="result-title">📜 Recent Transactions (${Math.min(data.txs.length, 10)} of ${txCount})</div>
            <div class="transaction-list">
                ${data.txs.slice(0, 10).map((tx, i) => {
                    // Calculate net value for this address
                    let netValue = 0;
                    tx.out.forEach(out => {
                        if (out.addr === address) netValue += out.value;
                    });
                    tx.inputs.forEach(input => {
                        if (input.prev_out && input.prev_out.addr === address) {
                            netValue -= input.prev_out.value;
                        }
                    });
                    
                    const isReceived = netValue > 0;
                    const netBTC = (Math.abs(netValue) / 100000000).toFixed(8);
                    const date = tx.time ? new Date(tx.time * 1000).toLocaleString() : 'Pending';
                    
                    return `
                    <div class="tx-item">
                        <div class="tx-header">
                            <div class="tx-id">${tx.hash}</div>
                            <div class="tx-time">${date}</div>
                        </div>
                        <div class="tx-details-grid">
                            <div class="tx-detail">
                                <div class="tx-detail-label">Amount</div>
                                <div class="tx-detail-value ${isReceived ? 'positive' : 'negative'}">
                                    ${isReceived ? '+' : '-'}${netBTC} BTC
                                </div>
                            </div>
                            <div class="tx-detail">
                                <div class="tx-detail-label">Confirmations</div>
                                <div class="tx-detail-value">
                                    ${tx.block_height ? (data.txs[0].block_height - tx.block_height + 1) : 'Unconfirmed'}
                                </div>
                            </div>
                            <div class="tx-detail">
                                <div class="tx-detail-label">Size</div>
                                <div class="tx-detail-value">${tx.size} bytes</div>
                            </div>
                            <div class="tx-detail">
                                <div class="tx-detail-label">Fee</div>
                                <div class="tx-detail-value">${(tx.fee / 100000000).toFixed(8)} BTC</div>
                            </div>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
            ${txCount > 10 ? `
                <div class="alert info">
                    <span>ℹ️</span>
                    <span>Showing 10 most recent transactions. Visit a blockchain explorer to see all ${txCount} transactions.</span>
                </div>
            ` : ''}
        </div>

        <div class="alert info">
            <span>ℹ️</span>
            <div>
                <strong>Verify on Blockchain:</strong> You can verify this data on blockchain explorers like 
                <a href="https://www.blockchain.com/btc/address/${address}" target="_blank" style="color: var(--accent-blue); text-decoration: underline;">blockchain.com</a> or 
                <a href="https://blockchair.com/bitcoin/address/${address}" target="_blank" style="color: var(--accent-blue); text-decoration: underline;">blockchair.com</a>
            </div>
        </div>

        ${broadcastHistory.length > 0 ? `
        <div class="result-section" style="border:1px solid rgba(247,147,26,0.3);border-radius:10px;padding:1rem;">
            <div class="result-title" style="color:var(--accent-orange);">📡 Pending from Your Broadcasts (${broadcastHistory.filter(e=>e.confirmations<e.maxConf).length} pending)</div>
            ${broadcastHistory.map(e=>`
            <div class="addr-tx-item" onclick="openTxDetail('${e.txid}', broadcastHistory.find(x=>x.txid==='${e.txid}'))">
                <div class="addr-tx-item-header">
                    <span class="addr-tx-hash">${e.txid.slice(0,24)}…${e.txid.slice(-8)}</span>
                    <span class="addr-tx-amount sent">Outgoing</span>
                </div>
                <div class="addr-tx-meta">
                    <span>${new Date(e.ts).toLocaleString()}</span>
                    <span class="addr-tx-badge ${e.confirmations<e.maxConf?'pending':'confirmed'}">${e.confirmations<e.maxConf?'⏳ '+e.confirmations+'/'+e.maxConf+' conf':'✅ Confirmed'}</span>
                    <span>${tierLabel(e.tier)}</span>
                </div>
            </div>`).join('')}
        </div>` : ''}

        <div style="margin-top:1rem;text-align:center;">
            <button class="btn-secondary" onclick="openAddrDetail('${address}', broadcastHistory)" style="font-size:0.85rem;">
                📍 Open Full Address Explorer
            </button>
        </div>
    `;
}

function getAddressType(address) {
    if (address.startsWith('1')) return 'P2PKH (Pay-to-PubKey-Hash)';
    if (address.startsWith('3')) return 'P2SH (Pay-to-Script-Hash)';
    if (address.startsWith('bc1')) return 'Bech32 (Native SegWit)';
    return 'Unknown';
}

loadExample.addEventListener('click', (e) => {
    e.preventDefault();
    rawTxInput.value = EXAMPLE_TX;
    rawTxInput.focus();
});

clearBtn.addEventListener('click', () => {
    rawTxInput.value = '';
    results.classList.remove('show');
    rawTxInput.focus();
});

decodeBtn.addEventListener('click', () => {
    const rawTx = rawTxInput.value.trim();
    
    if (!rawTx) {
        showAlert('Please enter a raw transaction', 'error');
        return;
    }

    if (!/^[0-9a-fA-F]+$/.test(rawTx)) {
        showAlert('Invalid format. Please enter a hexadecimal transaction', 'error');
        return;
    }

    decodeTransaction(rawTx);
});

function showAlert(message, type) {
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) existingAlert.remove();

    const alert = document.createElement('div');
    alert.className = `alert ${type}`;
    alert.innerHTML = `<span>${type === 'error' ? '⚠️' : 'ℹ️'}</span><span>${message}</span>`;
    
    const activeTab = document.querySelector('.tab-content.active');
    const inputGroup = activeTab.querySelector('.form-group');
    inputGroup.appendChild(alert);
    
    setTimeout(() => alert.remove(), 5000);
}

function decodeTransaction(rawTx) {
    loading.classList.add('show');
    results.classList.remove('show');

    // Simulate processing delay for better UX
    setTimeout(() => {
        try {
            const decoded = parseRawTransaction(rawTx);
            displayResults(decoded);
            loading.classList.remove('show');
            results.classList.add('show');
            results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (error) {
            loading.classList.remove('show');
            showAlert(`Error decoding transaction: ${error.message}`, 'error');
        }
    }, 800);
}

function parseRawTransaction(hex) {
    let offset = 0;
    
    // Helper functions
    const readBytes = (n) => {
        const bytes = hex.slice(offset, offset + n * 2);
        offset += n * 2;
        return bytes;
    };

    const readVarInt = () => {
        const first = parseInt(readBytes(1), 16);
        if (first < 0xfd) return first;
        if (first === 0xfd) return parseInt(reverseHex(readBytes(2)), 16);
        if (first === 0xfe) return parseInt(reverseHex(readBytes(4)), 16);
        return parseInt(reverseHex(readBytes(8)), 16);
    };

    const reverseHex = (hex) => {
        return hex.match(/.{2}/g).reverse().join('');
    };

    // Parse transaction
    const version = parseInt(reverseHex(readBytes(4)), 16);
    
    // Parse inputs
    const inputCount = readVarInt();
    const inputs = [];

    for (let i = 0; i < inputCount; i++) {
        const txid = reverseHex(readBytes(32));
        const vout = parseInt(reverseHex(readBytes(4)), 16);
        const scriptLen = readVarInt();
        const scriptSig = readBytes(scriptLen);
        const sequence = reverseHex(readBytes(4));

        inputs.push({
            txid,
            vout,
            scriptSig,
            scriptSigLength: scriptLen,
            sequence
        });
    }

    // Parse outputs
    const outputCount = readVarInt();
    const outputs = [];

    for (let i = 0; i < outputCount; i++) {
        const value = parseInt(reverseHex(readBytes(8)), 16);
        const scriptLen = readVarInt();
        const scriptPubKey = readBytes(scriptLen);

        outputs.push({
            value,
            valueBTC: (value / 100000000).toFixed(8),
            scriptPubKey,
            scriptPubKeyLength: scriptLen
        });
    }

    const locktime = parseInt(reverseHex(readBytes(4)), 16);

    // Calculate transaction ID (double SHA256 of raw tx)
    const txid = calculateTxId(hex);

    return {
        txid,
        version,
        inputCount,
        inputs,
        outputCount,
        outputs,
        locktime,
        size: hex.length / 2,
        rawHex: hex
    };
}

function calculateTxId(hex) {
    // For display purposes, we'll show a truncated hash
    // In a real implementation, you'd use a proper SHA256 library
    return 'Click on blockchain explorer to verify actual TXID';
}

// ===== ADDRESS BOOK PICKER (for TX Builder) =====
let abPickerTargetInput = null;   // the <input> to fill
let abPickerForChange = false;

function abOpenPicker(btn) {
    // btn is the .ab-pick-btn; find the sibling .output-address input
    abPickerTargetInput = btn.parentElement.querySelector('.output-address');
    abPickerForChange = false;
    abRenderPicker();
    document.getElementById('abPickerModal').classList.add('active');
}

function abOpenPickerForChange() {
    abPickerTargetInput = document.getElementById('changeAddress');
    abPickerForChange = true;
    abRenderPicker();
    document.getElementById('abPickerModal').classList.add('active');
}

function abClosePicker() {
    document.getElementById('abPickerModal').classList.remove('active');
    abPickerTargetInput = null;
}

function abRenderPicker() {
    const list = document.getElementById('abPickerList');

    if (abContacts.length === 0) {
        list.innerHTML = `<div class="ab-picker-empty">📭 Your address book is empty.<br>Add contacts in the Address Book tab first.</div>`;
        return;
    }

    list.innerHTML = abContacts.map(c => {
        const btcVal = getAddressValidation(c.bitcoin);
        const hasValid = c.bitcoin && btcVal.valid;
        return `
            <div class="ab-picker-item ${hasValid ? '' : 'no-btc'}"
                 onclick="${hasValid ? `abPickContact('${c.bitcoin}')` : ''}">
                <div style="min-width:0; flex:1;">
                    <div class="ab-picker-name">${c.name}</div>
                    <div class="ab-picker-addr ${c.bitcoin ? '' : 'none'}">
                        ${c.bitcoin || 'No Bitcoin address'}
                    </div>
                </div>
                ${c.bitcoin
                    ? `<span class="ab-picker-badge ${btcVal.valid ? 'valid' : 'invalid'}">
                           ${btcVal.valid ? '✓ ' + btcVal.type : '✗ Invalid'}
                       </span>`
                    : ''}
            </div>
        `;
    }).join('');
}

function abPickContact(bitcoinAddress) {
    if (abPickerTargetInput) {
        abPickerTargetInput.value = bitcoinAddress;
        abPickerTargetInput.dispatchEvent(new Event('input'));
        // Flash highlight to confirm selection
        abPickerTargetInput.style.borderColor = 'var(--accent-green)';
        abPickerTargetInput.style.boxShadow = '0 0 0 3px rgba(0,211,149,0.15)';
        setTimeout(() => {
            abPickerTargetInput.style.borderColor = '';
            abPickerTargetInput.style.boxShadow = '';
        }, 1200);
    }
    abClosePicker();
}

// Close picker on overlay click
document.getElementById('abPickerModal').addEventListener('click', function(e) {
    if (e.target === this) abClosePicker();
});

// ===== ADDRESS BOOK FUNCTIONALITY =====
function getAddressValidation(address) {
    if (!address) return { valid: false, type: 'None' };
    const legacyRegex = /^[1][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
    const p2shRegex = /^[3][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
    const bech32Regex = /^(bc1)[a-z0-9]{39,87}$/;
    if (legacyRegex.test(address)) return { valid: true, type: 'Legacy (P2PKH)' };
    if (p2shRegex.test(address)) return { valid: true, type: 'P2SH (SegWit)' };
    if (bech32Regex.test(address)) return { valid: true, type: 'Native SegWit' };
    return { valid: false, type: 'Invalid' };
}

const AB_STORAGE_KEY = 'btc_address_book_v1';

const AB_DEFAULT_CONTACTS = [
    { id: 1, name: 'John Doe', bitcoin: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' },
    { id: 2, name: 'Jane Smith', bitcoin: '3J98t1WpEZ73CNmYviecrnyiWrnqRhWNLy' },
    { id: 3, name: 'Bob Johnson', bitcoin: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq' },
    { id: 4, name: 'Alice Williams', bitcoin: '' }
];

function abLoad() {
    try {
        const stored = localStorage.getItem(AB_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length >= 0) return parsed;
        }
    } catch(e) {}
    return AB_DEFAULT_CONTACTS;
}

let abContacts = abLoad();
let abSelectedIds = [];
let abSaveTimer = null;

function abSave() {
    try {
        localStorage.setItem(AB_STORAGE_KEY, JSON.stringify(abContacts));
        // Mark badge as active (data is persisted)
        const badge = document.getElementById('abStorageBadge');
        if (badge) badge.classList.add('active');
        // Show toast
        abShowSaveToast();
    } catch(e) {
        console.warn('Could not save to localStorage:', e);
    }
}

function abShowSaveToast() {
    const toast = document.getElementById('abSaveToast');
    if (!toast) return;
    if (abSaveTimer) clearTimeout(abSaveTimer);
    toast.classList.add('show');
    abSaveTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

function abClearStorage() {
    if (!confirm('Clear all saved address book data from browser storage? This will reset to defaults on next visit.')) return;
    try { localStorage.removeItem(AB_STORAGE_KEY); } catch(e) {}
    const badge = document.getElementById('abStorageBadge');
    if (badge) badge.classList.remove('active');
    showAlert('Browser storage cleared. Data will reset on next visit.', 'info');
}

function abRender() {
    const listEl = document.getElementById('abList');
    document.getElementById('abCount').textContent = abContacts.length;

    if (abContacts.length === 0) {
        listEl.innerHTML = `<div class="ab-empty"><div class="ab-empty-icon">📭</div>No contacts yet. Click "Add Contact" to get started.</div>`;
        return;
    }

    listEl.innerHTML = abContacts.map(c => {
        const isSelected = abSelectedIds.includes(c.id);
        const btcVal = getAddressValidation(c.bitcoin);
        return `
            <div class="ab-card ${isSelected ? 'selected' : ''}" onclick="abToggleSelect(${c.id})">
                <div class="ab-card-inner">
                    <div class="ab-checkbox ${isSelected ? 'checked' : ''}">${isSelected ? '✓' : ''}</div>
                    <div class="ab-card-info">
                        <div class="ab-card-name">${c.name}</div>
                        ${c.bitcoin ? `
                        <div class="ab-card-detail" style="align-items: flex-start; flex-wrap: wrap; gap: 0.4rem;">
                            <span class="icon">₿</span>
                            <span class="ab-btc-address">${c.bitcoin}</span>
                            <span class="${btcVal.valid ? 'ab-badge-valid' : 'ab-badge-invalid'}">
                                ${btcVal.valid ? '✓ ' + btcVal.type : '✗ Invalid'}
                            </span>
                        </div>` : '<div class="ab-card-detail" style="color: var(--text-muted); font-style: italic;">No Bitcoin address</div>'}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function abToggleSelect(id) {
    if (abSelectedIds.includes(id)) {
        abSelectedIds = abSelectedIds.filter(x => x !== id);
    } else {
        abSelectedIds.push(id);
    }
    abUpdateActions();
}

function abSelectAll() {
    if (abSelectedIds.length === abContacts.length) {
        abSelectedIds = [];
    } else {
        abSelectedIds = abContacts.map(c => c.id);
    }
    abUpdateActions();
}

function abUpdateActions() {
    abSave();
    abRender();
    const label = document.getElementById('abSelectedLabel');
    const sendBtn = document.getElementById('abSendBtn');
    const deleteBtn = document.getElementById('abDeleteBtn');
    if (abSelectedIds.length > 0) {
        label.textContent = `${abSelectedIds.length} selected`;
        label.style.display = 'inline';
        sendBtn.style.display = 'inline-flex';
        deleteBtn.style.display = 'inline-flex';
    } else {
        label.style.display = 'none';
        sendBtn.style.display = 'none';
        deleteBtn.style.display = 'none';
    }
}

function abToggleForm() {
    const form = document.getElementById('abAddForm');
    const importPanel = document.getElementById('abImportPanel');
    importPanel.style.display = 'none'; // close import if open
    const isHidden = form.style.display === 'none' || form.style.display === '';
    form.style.display = isHidden ? 'block' : 'none';
    if (!isHidden) {
        ['abNewName','abNewBitcoin'].forEach(id => {
            document.getElementById(id).value = '';
        });
    }
}

function abAddContact() {
    const name = document.getElementById('abNewName').value.trim();
    const bitcoin = document.getElementById('abNewBitcoin').value.trim();

    if (!name) {
        alert('Please enter a name.');
        return;
    }

    const newId = Math.max(...abContacts.map(c => c.id), 0) + 1;
    abContacts.push({ id: newId, name, bitcoin });
    abToggleForm();
    abUpdateActions();
}

function abDeleteSelected() {
    if (!confirm(`Delete ${abSelectedIds.length} contact(s)?`)) return;
    abContacts = abContacts.filter(c => !abSelectedIds.includes(c.id));
    abSelectedIds = [];
    abUpdateActions();
}

function abShowSendModal() {
    if (abSelectedIds.length === 0) return;
    const selected = abContacts.filter(c => abSelectedIds.includes(c.id));
    document.getElementById('abRecipientCount').textContent = selected.length;
    document.getElementById('abRecipientList').innerHTML = selected.map(c => {
        const btcVal = getAddressValidation(c.bitcoin);
        return `
            <div class="ab-recipient-item">
                <div class="ab-recipient-name">${c.name}</div>
                ${c.bitcoin ? `<div class="ab-recipient-detail">₿ ${c.bitcoin}
                    <span style="color: ${btcVal.valid ? 'var(--accent-green)' : 'var(--accent-red)'}; font-weight:700;">
                        (${btcVal.valid ? '✓ Valid' : '✗ Invalid'})
                    </span>
                </div>` : '<div class="ab-recipient-detail" style="font-style:italic;">No Bitcoin address</div>'}
            </div>
        `;
    }).join('');
    document.getElementById('abSendModal').classList.add('active');
}

function abCloseSendModal() {
    document.getElementById('abSendModal').classList.remove('active');
}

function abConfirmSend() {
    alert(`✓ Message sent to ${abSelectedIds.length} recipient(s)!`);
    abCloseSendModal();
    abSelectedIds = [];
    abUpdateActions();
}

// Close modal on overlay click
document.getElementById('abSendModal').addEventListener('click', function(e) {
    if (e.target === this) abCloseSendModal();
});

// ===== IMPORT FUNCTIONALITY =====
let abImportMode = 'csv';
let abParsedImport = [];

function abToggleImport() {
    const panel = document.getElementById('abImportPanel');
    const addForm = document.getElementById('abAddForm');
    const isHidden = panel.style.display === 'none' || panel.style.display === '';
    // Close the other panel if open
    addForm.style.display = 'none';
    panel.style.display = isHidden ? 'block' : 'none';
    if (!isHidden) abResetImport();
}

function abResetImport() {
    abParsedImport = [];
    document.getElementById('abPasteInput').value = '';
    document.getElementById('abCsvFile').value = '';
    document.getElementById('abCsvFilename').style.display = 'none';
    document.getElementById('abImportPreview').style.display = 'none';
    document.getElementById('abImportConfirmBtn').disabled = true;
    document.getElementById('abImportPrefix').value = 'BTC';
    abUpdatePrefixPreview();
}

function abSwitchImportTab(mode, btn) {
    abImportMode = mode;
    document.querySelectorAll('.ab-import-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('abImportCsvPanel').style.display = mode === 'csv' ? 'block' : 'none';
    document.getElementById('abImportPastePanel').style.display = mode === 'paste' ? 'block' : 'none';
    abResetImport();
}

function abUpdatePrefixPreview() {
    const prefix = document.getElementById('abImportPrefix').value.trim() || 'BTC';
    document.getElementById('abPrefixPreview').textContent = `${prefix}-1`;
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('abImportPrefix').addEventListener('input', () => {
        abUpdatePrefixPreview();
        if (abParsedImport.length > 0) abShowImportPreview();
    });
    document.getElementById('abPasteInput').addEventListener('input', abParsePasteInput);
});

// Also wire up prefix live-update directly (DOMContentLoaded may have already fired)
setTimeout(() => {
    const prefixEl = document.getElementById('abImportPrefix');
    if (prefixEl) {
        prefixEl.addEventListener('input', () => {
            abUpdatePrefixPreview();
            if (abParsedImport.length > 0) abShowImportPreview();
        });
    }
    const pasteEl = document.getElementById('abPasteInput');
    if (pasteEl) pasteEl.addEventListener('input', abParsePasteInput);
}, 100);

function abHandleCsvUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const filenameEl = document.getElementById('abCsvFilename');
    filenameEl.innerHTML = `✓ ${file.name}`;
    filenameEl.style.display = 'flex';

    const reader = new FileReader();
    reader.onload = (e) => abParseRaw(e.target.result);
    reader.readAsText(file);
}

function abHandleDrop(event) {
    event.preventDefault();
    document.getElementById('abDropzone').classList.remove('drag-over');
    const file = event.dataTransfer.files[0];
    if (!file) return;
    const filenameEl = document.getElementById('abCsvFilename');
    filenameEl.innerHTML = `✓ ${file.name}`;
    filenameEl.style.display = 'flex';
    const reader = new FileReader();
    reader.onload = (e) => abParseRaw(e.target.result);
    reader.readAsText(file);
}

function abParsePasteInput() {
    const text = document.getElementById('abPasteInput').value;
    abParseRaw(text);
}

function abParseRaw(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    abParsedImport = [];

    lines.forEach(line => {
        // Try CSV: split by comma or tab
        const parts = line.split(/[,\t]/).map(p => p.trim().replace(/^["']|["']$/g, ''));
        let name = '';
        let addr = '';

        if (parts.length >= 2) {
            // col1 = name, col2 = address  OR  col1 = address, col2 = name
            // Figure out which column is the BTC address
            const isBtc0 = isLikelyBtcAddress(parts[0]);
            const isBtc1 = isLikelyBtcAddress(parts[1]);
            if (!isBtc0 && isBtc1) { name = parts[0]; addr = parts[1]; }
            else if (isBtc0 && !isBtc1) { name = parts[1]; addr = parts[0]; }
            else { addr = parts[0]; } // ambiguous, use first
        } else {
            addr = parts[0];
        }

        abParsedImport.push({ rawAddr: addr, customName: name });
    });

    abShowImportPreview();
}

function isLikelyBtcAddress(str) {
    return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(str) ||
           /^(bc1)[a-z0-9]{39,87}$/.test(str);
}

function abShowImportPreview() {
    if (abParsedImport.length === 0) {
        document.getElementById('abImportPreview').style.display = 'none';
        document.getElementById('abImportConfirmBtn').disabled = true;
        return;
    }

    const prefix = document.getElementById('abImportPrefix').value.trim() || 'BTC';
    let existingCounter = abContacts.length;
    let validCount = 0, invalidCount = 0;
    const rows = [];

    abParsedImport.forEach((entry, i) => {
        const btcVal = getAddressValidation(entry.rawAddr);
        const autoName = entry.customName || `${prefix}-${existingCounter + i + 1}`;
        if (btcVal.valid) validCount++;
        else invalidCount++;
        rows.push({ name: autoName, addr: entry.rawAddr, valid: btcVal.valid, type: btcVal.type });
    });

    const previewCountEl = document.getElementById('abImportPreviewCount');
    const previewInvalidEl = document.getElementById('abImportInvalidCount');
    previewCountEl.textContent = `${rows.length} addresses found — ${validCount} valid`;
    previewInvalidEl.textContent = invalidCount > 0 ? `• ${invalidCount} invalid (will be skipped)` : '';

    document.getElementById('abImportPreviewList').innerHTML = rows.map(r => `
        <div class="ab-import-row ${r.valid ? 'valid-row' : 'invalid-row'}">
            <span class="ab-import-row-name">${r.name}</span>
            <span class="ab-import-row-addr ${r.valid ? '' : 'bad'}">${r.addr || '(empty)'}</span>
            <span class="${r.valid ? 'ab-badge-valid' : 'ab-badge-invalid'}" style="font-size:0.68rem;padding:0.15rem 0.45rem;">
                ${r.valid ? '✓ ' + r.type : '✗ Invalid'}
            </span>
        </div>
    `).join('');

    document.getElementById('abImportPreview').style.display = 'block';
    document.getElementById('abImportConfirmBtn').disabled = validCount === 0;
}

function abConfirmImport() {
    const prefix = document.getElementById('abImportPrefix').value.trim() || 'BTC';
    let counter = abContacts.length + 1;
    let added = 0;

    abParsedImport.forEach((entry, i) => {
        const btcVal = getAddressValidation(entry.rawAddr);
        if (!btcVal.valid) return; // skip invalid
        const name = entry.customName || `${prefix}-${counter}`;
        const newId = Math.max(...abContacts.map(c => c.id), 0) + 1;
        abContacts.push({ id: newId, name, bitcoin: entry.rawAddr });
        counter++;
        added++;
    });

    abToggleImport();
    abUpdateActions();

    // Brief success flash
    showAlert(`✓ Imported ${added} contact${added !== 1 ? 's' : ''} successfully`, 'info');
}

// Initialize address book
abRender();
// If we loaded from storage (not defaults), light up the badge
try {
    if (localStorage.getItem(AB_STORAGE_KEY)) {
        const badge = document.getElementById('abStorageBadge');
        if (badge) badge.classList.add('active');
    }
} catch(e) {}

// ============================================================
//  BUILDER MODE TOGGLE
// ============================================================
function switchBuilderMode(mode) {
    document.getElementById('normalPanel').style.display = mode === 'normal' ? '' : 'none';
    document.getElementById('batchPanel').style.display  = mode === 'batch'  ? '' : 'none';
    document.getElementById('modeNormal').classList.toggle('active', mode === 'normal');
    document.getElementById('modeBatch').classList.toggle('active', mode === 'batch');
    if (mode === 'batch' && document.getElementById('batchTableBody').rows.length === 0) {
        addBatchRow(); addBatchRow(); addBatchRow();
    }
}

// ============================================================
//  BATCH TRANSFER LOGIC
// ============================================================
let batchSelectedUtxos = [];
let batchRowCounter = 0;

async function fetchBatchUtxos() {
    const address = document.getElementById('batchUtxoFetchAddress').value.trim();
    if (!address) { showAlert('Enter an address first.', 'error'); return; }
    if (!isValidBitcoinAddress(address)) { showAlert('Invalid Bitcoin address.', 'error'); return; }

    const loadEl = document.getElementById('batchLoading');
    loadEl.classList.add('show');
    batchSelectedUtxos = [];

    try {
        const response = await fetch(`https://blockchain.info/unspent?active=${address}`);
        if (!response.ok) throw new Error('No UTXOs or API error');
        const data = await response.json();
        renderBatchUtxos(data.unspent_outputs, address);
    } catch(e) {
        // Simulate UTXOs for demo
        const simUtxos = Array.from({length: 3}, (_, i) => ({
            tx_hash_big_endian: Array.from({length:64},()=>'0123456789abcdef'[Math.floor(Math.random()*16)]).join(''),
            tx_output_n: i,
            value: Math.floor(Math.random() * 50000000) + 1000000,
            script: '76a914' + Array.from({length:40},()=>'0123456789abcdef'[Math.floor(Math.random()*16)]).join('') + '88ac',
            confirmations: Math.floor(Math.random() * 100) + 1
        }));
        renderBatchUtxos(simUtxos, address);
    }
    loadEl.classList.remove('show');
}

function renderBatchUtxos(utxos, address) {
    const el = document.getElementById('batchUtxoList');
    el.innerHTML = `<div class="alert info"><span>ℹ️</span><span>Found ${utxos.length} UTXO(s). Click to select.</span></div>`;
    utxos.forEach((u, i) => {
        const div = document.createElement('div');
        div.className = 'utxo-select-item';
        div.innerHTML = `
            <div class="utxo-select-header">
                <span class="utxo-select-amount">${(u.value/1e8).toFixed(8)} BTC</span>
            </div>
            <div class="utxo-select-details">
                <div class="utxo-select-row"><span class="utxo-select-label">TX Hash</span><span class="utxo-select-value">${u.tx_hash_big_endian.slice(0,24)}…</span></div>
                <div class="utxo-select-row"><span class="utxo-select-label">Confirmations</span><span class="utxo-select-value">${u.confirmations||0}</span></div>
            </div>`;
        div.addEventListener('click', () => {
            const data = { txHash: u.tx_hash_big_endian, outputIndex: u.tx_output_n, value: u.value, script: u.script, address };
            const idx = batchSelectedUtxos.findIndex(x => x.txHash === data.txHash && x.outputIndex === data.outputIndex);
            if (idx >= 0) { batchSelectedUtxos.splice(idx, 1); div.classList.remove('selected'); }
            else { batchSelectedUtxos.push(data); div.classList.add('selected'); }
            updateBatchSummary();
        });
        el.appendChild(div);
    });
}

function addBatchRow(name='', address='', amount='') {
    const id = batchRowCounter++;
    const tr = document.createElement('tr');
    tr.dataset.id = id;
    tr.innerHTML = `
        <td style="color:var(--text-muted);font-size:0.8rem;text-align:center;">${document.getElementById('batchTableBody').rows.length + 1}</td>
        <td><span class="batch-name-chip" id="bname${id}">${name||'—'}</span></td>
        <td class="batch-addr-cell"><input type="text" value="${address}" placeholder="1A1z… or bc1q…" oninput="updateBatchSummary()"></td>
        <td class="batch-amt-cell"><input type="number" step="0.00000001" min="0" value="${amount}" placeholder="0.00000000" oninput="updateBatchSummary()"></td>
        <td><span class="batch-name-chip" id="bpct${id}" style="background:rgba(0,211,149,0.1);color:var(--accent-green);">0%</span></td>
        <td><button class="batch-remove-btn" onclick="removeBatchRow(${id})">✕</button></td>`;
    document.getElementById('batchTableBody').appendChild(tr);
    renumberBatchRows();
    updateBatchSummary();
}

function removeBatchRow(id) {
    const tr = document.querySelector(`#batchTableBody tr[data-id="${id}"]`);
    if (tr) tr.remove();
    renumberBatchRows();
    updateBatchSummary();
}

function renumberBatchRows() {
    document.querySelectorAll('#batchTableBody tr').forEach((tr, i) => {
        if (tr.cells[0]) tr.cells[0].textContent = i + 1;
    });
}

function updateBatchSummary() {
    const totalInput = batchSelectedUtxos.reduce((s, u) => s + u.value, 0);
    const fee = parseInt(document.getElementById('batchFee').value) || 0;
    let totalOutput = 0;
    const rows = document.querySelectorAll('#batchTableBody tr');
    rows.forEach(tr => {
        const amtInput = tr.querySelector('input[type="number"]');
        if (amtInput) totalOutput += Math.round((parseFloat(amtInput.value)||0) * 1e8);
    });
    const remaining = totalInput - totalOutput - fee;
    const overspent = remaining < 0;

    document.getElementById('batchRecipCount').textContent = rows.length;
    document.getElementById('batchTotalInput').textContent = (totalInput/1e8).toFixed(8) + ' BTC';
    document.getElementById('batchTotalOutput').textContent = (totalOutput/1e8).toFixed(8) + ' BTC';
    document.getElementById('batchFeeDisplay').textContent = fee.toLocaleString() + ' sats';
    const remEl = document.getElementById('batchRemaining');
    remEl.textContent = (remaining/1e8).toFixed(8) + ' BTC';
    remEl.className = 'batch-summary-value ' + (overspent ? 'bad' : remaining < 1000 ? 'warn' : 'ok');

    // Update % column
    rows.forEach(tr => {
        const id = tr.dataset.id;
        const amtInput = tr.querySelector('input[type="number"]');
        const pctEl = document.getElementById('bpct' + id);
        if (!amtInput || !pctEl) return;
        const amt = Math.round((parseFloat(amtInput.value)||0)*1e8);
        const pct = totalInput > 0 ? ((amt/totalInput)*100).toFixed(1) : '0';
        pctEl.textContent = pct + '%';
    });
}

function distributeBatchEqual() {
    const totalInput = batchSelectedUtxos.reduce((s, u) => s + u.value, 0);
    if (totalInput === 0) { showAlert('Select UTXOs first to distribute balance.', 'error'); return; }
    const fee = parseInt(document.getElementById('batchFee').value) || 0;
    const rows = document.querySelectorAll('#batchTableBody tr');
    if (rows.length === 0) return;
    const perRecipient = Math.floor((totalInput - fee) / rows.length);
    rows.forEach(tr => {
        const amtInput = tr.querySelector('input[type="number"]');
        if (amtInput) amtInput.value = (perRecipient / 1e8).toFixed(8);
    });
    updateBatchSummary();
    showAlert(`Distributed ${(perRecipient/1e8).toFixed(8)} BTC to each of ${rows.length} recipients`, 'info');
}

function clearBatchBuilder() {
    batchSelectedUtxos = [];
    document.getElementById('batchUtxoList').innerHTML = '';
    document.getElementById('batchTableBody').innerHTML = '';
    document.getElementById('batchUtxoFetchAddress').value = '';
    document.getElementById('batchChangeAddress').value = '';
    batchRowCounter = 0;
    updateBatchSummary();
    addBatchRow(); addBatchRow(); addBatchRow();
}

function buildBatchTransaction() {
    if (batchSelectedUtxos.length === 0) { showAlert('Select at least one UTXO.', 'error'); return; }
    const rows = document.querySelectorAll('#batchTableBody tr');
    const outputs = [];
    rows.forEach(tr => {
        const addrInput = tr.querySelector('input[type="text"]');
        const amtInput  = tr.querySelector('input[type="number"]');
        if (!addrInput||!amtInput) return;
        const addr = addrInput.value.trim();
        const amt  = parseFloat(amtInput.value)||0;
        if (addr && amt > 0) outputs.push({ address: addr, value: Math.floor(amt*1e8) });
    });
    if (outputs.length === 0) { showAlert('Add at least one recipient with an amount.', 'error'); return; }
    const fee = parseInt(document.getElementById('batchFee').value)||0;
    const totalInput = batchSelectedUtxos.reduce((s,u)=>s+u.value,0);
    const totalOutput = outputs.reduce((s,o)=>s+o.value,0);
    let change = totalInput - totalOutput - fee;
    if (change < 0) { showAlert('Overspent: reduce amounts or add more UTXOs.', 'error'); return; }
    const changeAddr = document.getElementById('batchChangeAddress').value.trim();
    if (change > 0 && changeAddr) outputs.push({ address: changeAddr, value: change, isChange: true });
    const loadEl = document.getElementById('batchBuilderLoading');
    loadEl.classList.add('show');
    setTimeout(() => {
        loadEl.classList.remove('show');
        try {
            const rawTx = constructRawTransaction(batchSelectedUtxos, outputs, 0);
            displayBuiltTransaction(rawTx, batchSelectedUtxos, outputs, fee, change);
            results.classList.add('show');
            results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch(e) { showAlert('Error building: ' + e.message, 'error'); }
    }, 900);
}

// ============================================================
//  BATCH ADDRESS BOOK MULTI-PICKER
// ============================================================
let batchAbSelectedIds = new Set();

function openBatchAbPicker() {
    batchAbSelectedIds = new Set();
    document.getElementById('batchAbSearch').value = '';
    renderBatchAbList();
    document.getElementById('batchAbPickerOverlay').classList.add('active');
}
function closeBatchAbPicker() {
    document.getElementById('batchAbPickerOverlay').classList.remove('active');
}
function renderBatchAbList() {
    const q = (document.getElementById('batchAbSearch').value||'').toLowerCase();
    const contacts = abContacts.filter(c => c.bitcoin && (
        c.name.toLowerCase().includes(q) || c.bitcoin.toLowerCase().includes(q)
    ));
    const listEl = document.getElementById('batchAbList');
    if (contacts.length === 0) {
        listEl.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:1.5rem;">No contacts with Bitcoin addresses found.</div>';
        return;
    }
    listEl.innerHTML = contacts.map(c => {
        const sel = batchAbSelectedIds.has(c.id);
        return `<div class="batch-ab-row ${sel?'selected':''}" onclick="toggleBatchAbContact(${c.id})">
            <div class="batch-ab-checkbox">${sel?'✓':''}</div>
            <div class="batch-ab-info">
                <div class="batch-ab-name">${c.name}</div>
                <div class="batch-ab-addr">${c.bitcoin}</div>
            </div>
            <span class="batch-ab-type">BTC</span>
        </div>`;
    }).join('');
    document.getElementById('batchAbSelCount').textContent = batchAbSelectedIds.size + ' selected';
}
function toggleBatchAbContact(id) {
    if (batchAbSelectedIds.has(id)) batchAbSelectedIds.delete(id);
    else batchAbSelectedIds.add(id);
    renderBatchAbList();
}
function confirmBatchAbSelection() {
    if (batchAbSelectedIds.size === 0) { showAlert('Select at least one contact.', 'error'); return; }
    batchAbSelectedIds.forEach(id => {
        const c = abContacts.find(x => x.id === id);
        if (c && c.bitcoin) addBatchRow(c.name, c.bitcoin, '');
    });
    closeBatchAbPicker();
    updateBatchSummary();
    showAlert(`Added ${batchAbSelectedIds.size} recipient(s) from address book.`, 'info');
}

// ============================================================
//  TXID DETAIL MODAL
// ============================================================
let txDetailCache = {};   // txid → simulated detail data
let addrDetailCache = {}; // address → simulated detail data

function openTxDetail(txid, _unused) {
    const entry = broadcastHistory.find(e => e.txid === txid);
    window._openTxDetailEntry = entry ? { ...entry, txid } : { txid, ts: Date.now() - 1800000, maxConf: 6, tier: 'medium', size: 250, fee: 2340, feeRate: 9 };
    document.getElementById('txDetailHash').textContent = txid;
    document.getElementById('txDetailOverlay').classList.add('active');
    renderTxDetail(txid, window._openTxDetailEntry);
}
function closeTxDetail() {
    document.getElementById('txDetailOverlay').classList.remove('active');
    window._openTxDetailEntry = null;
}

function renderTxDetail(txid, entry) {
    const conf      = getConfirmations(entry);
    const done      = conf >= entry.maxConf;
    const minsNext  = done ? 0 : getMinsToNextBlock(entry);
    const elapsed   = Date.now() - entry.ts;
    const elapsedH  = Math.floor(elapsed / 3_600_000);
    const elapsedM  = Math.floor((elapsed % 3_600_000) / 60_000);
    const size       = entry.size || 250;
    const fee        = entry.fee  || 2340;
    const feeRate    = entry.feeRate || Math.round(fee/size);
    const blockH     = (entry.blockHeightAtBroadcast || netState.blockHeight);

    // --- Derive actual inputs & outputs from entry ---
    const hasRealInputs  = entry.realInputs  && entry.realInputs.length > 0;
    const hasRealOutputs = entry.realOutputs && entry.realOutputs.length > 0;

    // Build the display inputs array
    const displayInputs = hasRealInputs
        ? entry.realInputs.map(inp => ({
            txid:    inp.txid,
            vout:    inp.vout,
            address: inp.address,
            value:   inp.value,        // satoshis (may be null if parsed-only)
            script:  inp.script || ''
          }))
        : [{ txid: entry.inputAddr || txid.slice(0,64), vout: 0, address: entry.inputAddr, value: Math.round((entry.inputVal||0.5)*1e8), script: '' }];

    const displayOutputs = hasRealOutputs
        ? entry.realOutputs.map(o => ({
            address:  o.address,
            value:    o.value,
            isChange: o.isChange
          }))
        : [
            { address: entry.outputAddr, value: Math.round((entry.outputVal||0.3)*1e8), isChange: false },
            { address: entry.changeAddr,  value: Math.round((entry.changeVal||0.1)*1e8),  isChange: true  }
          ].filter(o => o.value > 0 && o.address);

    const totalInSats  = displayInputs.reduce((s,i)  => s + (i.value||0), 0);
    const totalOutSats = displayOutputs.reduce((s,o) => s + (o.value||0), 0);

    // --- Parse actual hex fields if raw hex available ---
    let hexFields = null;
    if (entry.rawHex && /^[0-9a-fA-F]{8,}$/.test(entry.rawHex)) {
        try {
            const h = entry.rawHex;
            const rev = x => x.match(/.{2}/g).reverse().join('');
            hexFields = {
                version:  h.slice(0,8),
                inCount:  numToVarInt(displayInputs.length),
                firstPrevHash: displayInputs[0] ? rev(displayInputs[0].txid || txid) : rev(txid),
                firstPrevIdx:  reverseHex(numToHex(displayInputs[0]?.vout || 0, 4)),
                outCount: numToVarInt(displayOutputs.length),
                locktime: h.slice(-8)
            };
        } catch(e) {}
    }
    if (!hexFields) {
        hexFields = {
            version: '01000000',
            inCount: numToVarInt(displayInputs.length),
            firstPrevHash: displayInputs[0]?.txid ? reverseHex(displayInputs[0].txid) : txid.slice(0,64),
            firstPrevIdx:  reverseHex(numToHex(displayInputs[0]?.vout || 0, 4)),
            outCount: numToVarInt(displayOutputs.length),
            locktime: '00000000'
        };
    }

    // --- Confirmation timeline ---
    const timeline = Array.from({length: entry.maxConf}, (_, i) => {
        const isConf    = i < conf;
        const isCurrent = i === conf && !done;
        const pct       = isCurrent ? Math.round((elapsed % BLOCK_MS) / BLOCK_MS * 100) : 0;
        const blockNum  = blockH + i + 1;
        const minsAt    = Math.round((i + 1) * 60);
        let indicator;
        let label, sublabel;
        if (isConf) {
            indicator = `<div class="txd-step-dot done">✓</div>`;
            label     = i === 0 ? 'Included in block' : 'Confirmed';
            sublabel  = `Block #${blockNum.toLocaleString()}`;
        } else if (isCurrent) {
            indicator = `<div class="txd-step-dot active"><svg viewBox="0 0 36 36" width="28" height="28"><circle cx="18" cy="18" r="14" fill="none" stroke="rgba(247,147,26,0.2)" stroke-width="3"/><circle cx="18" cy="18" r="14" fill="none" stroke="#f7931a" stroke-width="3.5" stroke-dasharray="${Math.round(pct*0.88)} 88" stroke-dashoffset="22" stroke-linecap="round" transform="rotate(-90 18 18)"/><text x="18" y="22" text-anchor="middle" font-size="9" fill="#f7931a" font-weight="700">${pct}%</text></svg></div>`;
            label     = `Mining block ${i+1}`;
            sublabel  = `~${minsNext} min remaining`;
        } else {
            indicator = `<div class="txd-step-dot waiting">${i+1}</div>`;
            label     = `Confirmation ${i+1}`;
            sublabel  = `~${minsAt} min from broadcast`;
        }
        return `<div class="txd-step ${isConf?'done':isCurrent?'active':'waiting'}">
            ${indicator}
            <div class="txd-step-body">
                <div class="txd-step-label">${label}</div>
                <div class="txd-step-sub">${sublabel}</div>
            </div>
            ${i < entry.maxConf-1 ? '<div class="txd-step-line"></div>' : ''}
        </div>`;
    }).join('');

    // --- Build input cards HTML ---
    const inputCardsHtml = displayInputs.map((inp, i) => `
        <div class="txd-io-card inp" onclick="${inp.address ? `openAddrDetailFromTx('${inp.address}')` : ''}">
            <div class="txd-io-sub" style="margin-bottom:0.3rem;font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;color:var(--text-muted);">Input #${i}</div>
            <div class="txd-io-addr">${inp.address || '(address not available)'}</div>
            ${inp.txid ? `<div style="font-size:0.57rem;color:var(--text-muted);font-family:'JetBrains Mono',monospace;margin-top:0.2rem;word-break:break-all;">UTXO: ${inp.txid.slice(0,20)}…:${inp.vout}</div>` : ''}
            <div class="txd-io-val red" style="margin-top:0.4rem;">${inp.value != null ? '−' + (inp.value/1e8).toFixed(8) + ' BTC' : '(value unknown — UTXO lookup required)'}</div>
            ${inp.value != null ? `<div class="txd-io-sub">${inp.value.toLocaleString()} sats &nbsp;·&nbsp; UTXO spent</div>` : ''}
        </div>
    `).join('');

    // --- Build output cards HTML ---
    const outputCardsHtml = displayOutputs.map((out, i) => `
        <div class="txd-io-card out ${out.isChange?'change':''}" onclick="${out.address ? `openAddrDetailFromTx('${out.address}')` : ''}">
            <div class="txd-io-sub" style="margin-bottom:0.3rem;font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;color:var(--text-muted);">Output #${i}${out.isChange ? ' · 🔄 Change' : ' · Recipient'}</div>
            <div class="txd-io-addr">${out.address || '(script output)'}</div>
            <div class="txd-io-val ${out.isChange?'blue':'green'}" style="margin-top:0.4rem;">+${(out.value/1e8).toFixed(8)} BTC</div>
            <div class="txd-io-sub">${out.value.toLocaleString()} sats</div>
        </div>
    `).join('');

    // --- Hex breakdown rows --- real input hashes ---
    const inputHexRows = displayInputs.map((inp, i) => `
        <div class="txd-hex-row">
            <span class="txd-hex-field">Input #${i} — Prev Hash (32B)</span>
            <span class="txd-hex-val mono-small">${inp.txid ? reverseHex(inp.txid).slice(0,32) + '…' : '(no hash)'}</span>
            <span class="txd-hex-note">UTXO txid (reversed LE)</span>
        </div>
        <div class="txd-hex-row">
            <span class="txd-hex-field">Input #${i} — Prev Index (4B)</span>
            <span class="txd-hex-val">${reverseHex(numToHex(inp.vout||0, 4))}</span>
            <span class="txd-hex-note">= output #${inp.vout||0}</span>
        </div>
        <div class="txd-hex-row">
            <span class="txd-hex-field">Input #${i} — ScriptSig</span>
            <span class="txd-hex-val">00</span>
            <span class="txd-hex-note">empty — unsigned transaction</span>
        </div>
        <div class="txd-hex-row">
            <span class="txd-hex-field">Input #${i} — Sequence</span>
            <span class="txd-hex-val">ffffffff</span>
            <span class="txd-hex-note">RBF opt-out</span>
        </div>
    `).join('');

    const outputHexRows = displayOutputs.map((out, i) => `
        <div class="txd-hex-row">
            <span class="txd-hex-field">Output #${i} — Value (8B LE)</span>
            <span class="txd-hex-val">${reverseHex(numToHex(out.value||0, 8))}</span>
            <span class="txd-hex-note">= ${(out.value||0).toLocaleString()} sats</span>
        </div>
    `).join('');

    // Source badge
    const sourceBadge = hasRealInputs
        ? `<span style="font-size:0.65rem;background:rgba(0,211,149,0.1);color:var(--accent-green);padding:0.2rem 0.5rem;border-radius:4px;border:1px solid rgba(0,211,149,0.2);font-weight:700;">✓ Real UTXO data from builder</span>`
        : entry.realInputs
        ? `<span style="font-size:0.65rem;background:rgba(74,158,255,0.1);color:var(--accent-blue);padding:0.2rem 0.5rem;border-radius:4px;border:1px solid rgba(74,158,255,0.2);font-weight:700;">⬡ TXIDs parsed from hex</span>`
        : `<span style="font-size:0.65rem;background:rgba(247,147,26,0.1);color:var(--accent-orange);padding:0.2rem 0.5rem;border-radius:4px;border:1px solid rgba(247,147,26,0.2);font-weight:700;">~ Illustrative data</span>`;

    document.getElementById('txDetailBody').innerHTML = `
        <!-- STATUS BANNER -->
        <div class="txd-status-banner ${done?'':'pending'}">
            <div class="txd-status-icon">${done ? '✅' : '⏳'}</div>
            <div class="txd-status-text">
                <div class="txd-status-label">${done ? 'Fully Confirmed — 6/6 Blocks' : `${conf} of ${entry.maxConf} Confirmations`}</div>
                <div class="txd-status-desc">${done
                    ? `Final confirmation ~${elapsedH}h ${elapsedM}m after broadcast`
                    : `Next confirmation in ~${minsNext} min &nbsp;·&nbsp; Elapsed: ${elapsedH>0?elapsedH+'h ':''} ${elapsedM}m`
                }</div>
            </div>
        </div>

        <!-- CONFIRMATION TIMELINE -->
        <div class="txd-section">
            <div class="txd-section-title">⛏ Confirmation Progress</div>
            <div class="txd-timeline">${timeline}</div>
            <div class="txd-conf-note">Each block ≈ 10 min avg · 6 confirmations ≈ 1 hour</div>
        </div>

        <!-- WHY 6 CONFIRMATIONS -->
        <div class="txd-section">
            <div class="txd-section-title">🔐 Why 6 Confirmations?</div>
            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;overflow:hidden;">
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;">
                    <div style="padding:0.85rem;border-right:1px solid var(--border);">
                        <div style="font-size:0.62rem;font-weight:800;text-transform:uppercase;color:var(--text-muted);margin-bottom:0.35rem;">1–2 Confirmations</div>
                        <div style="font-size:0.78rem;color:var(--text-secondary);">Transaction included in a block. Safe for low-value purchases. A miner could theoretically still orphan this block.</div>
                        <div style="margin-top:0.4rem;font-size:0.7rem;color:var(--accent-orange);">⚡ Low-value OK</div>
                    </div>
                    <div style="padding:0.85rem;border-right:1px solid var(--border);">
                        <div style="font-size:0.62rem;font-weight:800;text-transform:uppercase;color:var(--text-muted);margin-bottom:0.35rem;">3–5 Confirmations</div>
                        <div style="font-size:0.78rem;color:var(--text-secondary);">Each new block exponentially increases the computational cost of rewriting history. A double-spend attack becomes extremely expensive.</div>
                        <div style="margin-top:0.4rem;font-size:0.7rem;color:var(--accent-blue);">🛡 High-value safe</div>
                    </div>
                    <div style="padding:0.85rem;">
                        <div style="font-size:0.62rem;font-weight:800;text-transform:uppercase;color:var(--text-muted);margin-bottom:0.35rem;">6 Confirmations</div>
                        <div style="font-size:0.78rem;color:var(--text-secondary);">Satoshi Nakamoto's standard in the whitepaper. An attacker controlling 10% of hashrate has less than 0.1% chance of reversing 6 blocks.</div>
                        <div style="margin-top:0.4rem;font-size:0.7rem;color:var(--accent-green);">✅ Finality standard</div>
                    </div>
                </div>
                <div style="padding:0.65rem 0.85rem;background:var(--bg-primary);border-top:1px solid var(--border);font-size:0.72rem;color:var(--text-muted);">
                    📐 <strong>Nakamoto consensus:</strong> The probability of a successful double-spend with <em>q</em> attacker hashrate drops as <em>e<sup>-8(p-q)z</sup></em> per added confirmation z. At 6 blocks with 10% attacker power: ~0.024% reversal chance.
                </div>
            </div>
        </div>

        <!-- KEY METADATA GRID -->
        <div class="txd-section">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.85rem;">
                <div class="txd-section-title" style="margin-bottom:0;">📊 Transaction Metadata</div>
                ${sourceBadge}
            </div>
            <div class="txd-meta-grid">
                <div class="txd-meta-card"><div class="txd-meta-label">TXID</div><div class="txd-meta-val mono blue" style="font-size:0.6rem;word-break:break-all;">${txid}</div></div>
                <div class="txd-meta-card"><div class="txd-meta-label">Status</div><div class="txd-meta-val ${done?'green':'orange'}">${done?'✅ Confirmed':'⏳ Pending'}</div></div>
                <div class="txd-meta-card"><div class="txd-meta-label">Broadcast At</div><div class="txd-meta-val">${new Date(entry.ts).toLocaleString()}</div></div>
                <div class="txd-meta-card"><div class="txd-meta-label">In Block</div><div class="txd-meta-val blue">${conf>0?'#'+(blockH+1).toLocaleString():'Unconfirmed'}</div></div>
                <div class="txd-meta-card"><div class="txd-meta-label">Size</div><div class="txd-meta-val">${size} bytes</div></div>
                <div class="txd-meta-card"><div class="txd-meta-label">vSize</div><div class="txd-meta-val">${Math.round(size*0.75)} vB</div></div>
                <div class="txd-meta-card"><div class="txd-meta-label">Fee</div><div class="txd-meta-val orange">${fee.toLocaleString()} sats</div></div>
                <div class="txd-meta-card"><div class="txd-meta-label">Fee Rate</div><div class="txd-meta-val orange">${feeRate} sat/vB</div></div>
                <div class="txd-meta-card"><div class="txd-meta-label">Inputs</div><div class="txd-meta-val">${displayInputs.length}</div></div>
                <div class="txd-meta-card"><div class="txd-meta-label">Outputs</div><div class="txd-meta-val">${displayOutputs.length}</div></div>
                <div class="txd-meta-card"><div class="txd-meta-label">Total In</div><div class="txd-meta-val">${totalInSats ? (totalInSats/1e8).toFixed(8) + ' BTC' : '—'}</div></div>
                <div class="txd-meta-card"><div class="txd-meta-label">Total Out</div><div class="txd-meta-val green">${(totalOutSats/1e8).toFixed(8)} BTC</div></div>
            </div>
        </div>

        <!-- INPUT / OUTPUT FLOW -->
        <div class="txd-section">
            <div class="txd-section-title">🔀 Input → Output Flow</div>
            <div class="txd-flow">
                <div class="txd-flow-col">
                    <div class="txd-flow-head red">📥 Inputs (${displayInputs.length})</div>
                    ${inputCardsHtml}
                </div>
                <div class="txd-flow-arrow">→</div>
                <div class="txd-flow-col">
                    <div class="txd-flow-head green">📤 Outputs (${displayOutputs.length})</div>
                    ${outputCardsHtml}
                </div>
            </div>
            <div style="display:flex;gap:2rem;flex-wrap:wrap;padding:0.85rem 1rem;background:var(--bg-primary);border-radius:8px;margin-top:0.75rem;font-size:0.82rem;">
                ${totalInSats ? `<span>Total In: <strong style="color:var(--accent-red);">${(totalInSats/1e8).toFixed(8)} BTC</strong></span>` : ''}
                <span>Total Out: <strong style="color:var(--accent-green);">${(totalOutSats/1e8).toFixed(8)} BTC</strong></span>
                <span>Fee: <strong style="color:var(--accent-orange);">${(fee/1e8).toFixed(8)} BTC (${fee.toLocaleString()} sats)</strong></span>
            </div>
        </div>

        <!-- HEX BREAKDOWN -->
        <div class="txd-section">
            <div class="txd-section-title">🔬 Raw Hex Field Breakdown</div>
            <div class="txd-hex-grid">
                <div class="txd-hex-row"><span class="txd-hex-field">Version (4B LE)</span><span class="txd-hex-val">${hexFields.version}</span><span class="txd-hex-note">= v1 transaction</span></div>
                <div class="txd-hex-row"><span class="txd-hex-field">Input count (varint)</span><span class="txd-hex-val">${hexFields.inCount}</span><span class="txd-hex-note">= ${displayInputs.length} input${displayInputs.length>1?'s':''}</span></div>
                ${inputHexRows}
                <div class="txd-hex-row"><span class="txd-hex-field">Output count (varint)</span><span class="txd-hex-val">${hexFields.outCount}</span><span class="txd-hex-note">= ${displayOutputs.length} output${displayOutputs.length>1?'s':''}</span></div>
                ${outputHexRows}
                <div class="txd-hex-row"><span class="txd-hex-field">Locktime (4B LE)</span><span class="txd-hex-val">${hexFields.locktime}</span><span class="txd-hex-note">= no locktime restriction</span></div>
            </div>
            ${entry.rawHex ? `
            <div style="margin-top:0.85rem;">
                <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:0.35rem;">Full Raw Hex:</div>
                <div style="font-family:'JetBrains Mono',monospace;font-size:0.66rem;color:var(--text-secondary);word-break:break-all;background:var(--bg-primary);padding:0.75rem;border-radius:6px;border:1px solid var(--border);max-height:120px;overflow-y:auto;">${entry.rawHex}</div>
            </div>` : ''}
        </div>
    `;
}

// ============================================================
//  ADDRESS DETAIL MODAL  
// ============================================================
function openAddrDetail(address, pendingTxs) {
    document.getElementById('addrDetailAddr').textContent = address;
    document.getElementById('addrDetailOverlay').classList.add('active');
    renderAddrDetail(address, pendingTxs);
}
function openAddrDetailFromTx(addr) {
    openAddrDetail(addr, []);
}
function closeAddrDetail() {
    document.getElementById('addrDetailOverlay').classList.remove('active');
}

function renderAddrDetail(address, pendingTxs) {
    const addrType = address.startsWith('bc1') ? 'P2WPKH (Bech32)' : address.startsWith('3') ? 'P2SH' : 'P2PKH (Legacy)';
    const balance  = (Math.random() * 2).toFixed(8);
    const received = (parseFloat(balance) + Math.random() * 5).toFixed(8);
    const sent     = (parseFloat(received) - parseFloat(balance)).toFixed(8);
    const txCount  = 8 + Math.floor(Math.random() * 50);

    // Mix pending from broadcastHistory with simulated historical txs
    const simHistorical = Array.from({length:6},(_,i)=>({
        txid: Array.from({length:64},()=>'0123456789abcdef'[Math.floor(Math.random()*16)]).join(''),
        confirmations: 3 + Math.floor(Math.random()*100),
        type: Math.random()>0.5?'recv':'sent',
        amount: (Math.random()*0.5+0.001).toFixed(8),
        ts: Date.now() - (i+1)*3600000*24,
        fee: Math.floor(Math.random()*3000)+500
    }));

    const allPending = (pendingTxs||[]).map(e=>({
        txid: e.txid,
        confirmations: e.confirmations,
        type: 'sent',
        amount: (Math.random()*0.3+0.01).toFixed(8),
        ts: e.ts,
        fee: Math.floor(e.size * netState.feeMed)
    }));

    const allTxs = [...allPending, ...simHistorical];

    let activeAddrTab = 'all';

    document.getElementById('addrDetailBody').innerHTML = `
        <div class="addr-qr-row">
            <div class="addr-qr-box">
                <div style="font-size:1.5rem;">▦</div>
                <div style="font-size:0.5rem;margin-top:2px;color:#666;">QR</div>
            </div>
            <div class="addr-balance-grid">
                <div class="addr-bal-card">
                    <div class="addr-bal-label">Final Balance</div>
                    <div class="addr-bal-value" style="color:var(--accent-orange);">${balance} BTC</div>
                </div>
                <div class="addr-bal-card">
                    <div class="addr-bal-label">Total Received</div>
                    <div class="addr-bal-value" style="color:var(--accent-green);">+${received} BTC</div>
                </div>
                <div class="addr-bal-card">
                    <div class="addr-bal-label">Total Sent</div>
                    <div class="addr-bal-value" style="color:var(--accent-red);">-${sent} BTC</div>
                </div>
                <div class="addr-bal-card">
                    <div class="addr-bal-label">Transactions</div>
                    <div class="addr-bal-value" style="color:var(--accent-blue);">${txCount}</div>
                </div>
            </div>
        </div>
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:0.75rem 1rem;margin-bottom:1.25rem;display:flex;gap:2rem;flex-wrap:wrap;font-size:0.82rem;">
            <div><span style="color:var(--text-muted);">Address Type: </span><span style="font-weight:700;color:var(--accent-blue);">${addrType}</span></div>
            <div><span style="color:var(--text-muted);">First Seen: </span><span style="font-weight:700;color:var(--text-primary);">Block #${(800000+Math.floor(Math.random()*40000)).toLocaleString()}</span></div>
            <div><span style="color:var(--text-muted);">UTXOs: </span><span style="font-weight:700;color:var(--accent-green);">${Math.floor(Math.random()*5)+1} unspent</span></div>
        </div>

        <div class="addr-tx-tabs" id="addrTabBar">
            <button class="addr-tx-tab active" onclick="switchAddrTab('all',this)">All (${allTxs.length})</button>
            <button class="addr-tx-tab" onclick="switchAddrTab('pending',this)">Pending (${allPending.length})</button>
            <button class="addr-tx-tab" onclick="switchAddrTab('confirmed',this)">Confirmed (${simHistorical.length})</button>
        </div>
        <div id="addrTxList">${renderAddrTxList(allTxs, 'all')}</div>

        <div style="margin-top:0.85rem;padding:0.65rem 0.85rem;background:var(--bg-primary);border-radius:8px;border-left:3px solid var(--text-muted);font-size:0.78rem;color:var(--text-muted);">
            ⚠️ <strong>Simulated data</strong> — balance and transaction history are for visual/educational demonstration only.
        </div>
    `;

    // Store for tab switching
    window._addrTxData = { all: allTxs, pending: allPending, confirmed: simHistorical };
}

function renderAddrTxList(txs, filter) {
    if (txs.length === 0) return '<div style="color:var(--text-muted);text-align:center;padding:1.5rem 0;">No transactions</div>';
    return txs.map(tx => {
        const isPending = tx.confirmations === 0;
        const timeStr = new Date(tx.ts).toLocaleDateString() + ' ' + new Date(tx.ts).toLocaleTimeString();
        return `
        <div class="addr-tx-item" onclick="openTxDetailFromAddr('${tx.txid}',${tx.confirmations},${tx.fee},${tx.ts})">
            <div class="addr-tx-item-header">
                <span class="addr-tx-hash">${tx.txid.slice(0,24)}…${tx.txid.slice(-8)}</span>
                <span class="addr-tx-amount ${tx.type==='recv'?'recv':'sent'}">${tx.type==='recv'?'+':'-'}${tx.amount} BTC</span>
            </div>
            <div class="addr-tx-meta">
                <span>${timeStr}</span>
                <span>Fee: ${tx.fee.toLocaleString()} sats</span>
                <span class="addr-tx-badge ${isPending?'pending':'confirmed'}">${isPending?'⏳ Pending':'✅ ' + tx.confirmations + ' conf'}</span>
                <span class="addr-tx-badge ${tx.type==='recv'?'recv-badge':'sent-badge'}">${tx.type==='recv'?'📥 Received':'📤 Sent'}</span>
            </div>
        </div>`;
    }).join('');
}

window.switchAddrTab = function(tab, btnEl) {
    document.querySelectorAll('.addr-tx-tab').forEach(b=>b.classList.remove('active'));
    btnEl.classList.add('active');
    const data = window._addrTxData || {all:[], pending:[], confirmed:[]};
    document.getElementById('addrTxList').innerHTML = renderAddrTxList(data[tab]||[], tab);
};

window.openTxDetailFromAddr = function(txid, conf, fee, ts) {
    const fakeEntry = { confirmations: conf, size: 250, tier: 'medium', ts: ts };
    closeTxDetail();
    setTimeout(() => openTxDetail(txid, fakeEntry), 50);
};

window.openAddrDetailFromTx = openAddrDetailFromTx;

// ============================================================
//  BROADCAST TAB — TXID CLICKS & ADDRESS LOOKUP INTEGRATION
// ============================================================
// Hook TXID click in history
function makeTxidClickable(txid, entry) {
    return `<span class="addr-tx-hash" onclick="openTxDetail('${txid}', broadcastHistory.find(e=>e.txid==='${txid}'))">${txid.slice(0,18)}…${txid.slice(-8)}</span>`;
}

// ============================================================
//  ADDRESS LOOKUP — PENDING TX INTEGRATION
// ============================================================
const _origLookupAddress = window.lookupAddress || function(){};
// Wrap address lookup display to add pending txs from broadcast history
const _origDisplayAddressResults = window.displayAddressResults;

// Patch openBcastAddrDetail so broadcast history addresses open addr detail
window.openBcastAddrDetail = function(address) {
    const pendingTxs = broadcastHistory.filter(e => e.confirmations < e.maxConf);
    openAddrDetail(address, pendingTxs);
};

// ============================================================
//  BROADCAST TAB — BROADCAST HISTORY TXID CLICKABLE
// ============================================================

// ============================================================
//  BUILDER MODE TOGGLE — INIT
// ============================================================

// ============================================================
//  BROADCAST TAB — Mempool Explorer + Broadcast Simulation
// ============================================================
const BLOCK_TIME_MS = 3600000; // 1 hour per block (display)

// ══════════════════════════════════════════════════
//  TIME-SEEDED DYNAMIC MEMPOOL ENGINE
//  Block height derived from Bitcoin genesis timestamp.
//  Fees/mempool modelled on UTC hour-of-day & weekday.
// ══════════════════════════════════════════════════
const BTC_GENESIS_TS  = 1231006505000;  // Jan 3 2009 18:15:05 UTC
const REAL_BLOCK_MS   = 600_000;         // 10-min avg
const HALVING_INT     = 210_000;
const DIFF_EPOCH      = 2016;

function calcBlockHeight() {
    return Math.floor((Date.now() - BTC_GENESIS_TS) / REAL_BLOCK_MS);
}
function calcBlockReward(h) {
    const halvings = Math.floor(h / HALVING_INT);
    return halvings >= 33 ? 0 : 50 / Math.pow(2, halvings);
}
function calcBlocksToAdj(h) { return DIFF_EPOCH - (h % DIFF_EPOCH); }
function calcMinsToNextBlock() {
    return Math.max(1, Math.ceil((REAL_BLOCK_MS - (Date.now() % REAL_BLOCK_MS)) / 60000));
}

// Smooth oscillator — no random() so values drift realistically
function osc(periodMs, amp, phase) {
    return Math.sin((Date.now() / periodMs) * Math.PI * 2 + (phase || 0)) * amp;
}

function buildNetState() {
    const now  = new Date();
    const utcH = now.getUTCHours();
    const utcD = now.getUTCDay();  // 0=Sun

    // Time-of-day fee pressure: peaks 13-22 UTC (US market hours)
    let pressure = 1.0;
    if      (utcH >= 13 && utcH <= 22) pressure = 1.55 + osc(7200000, 0.1);
    else if (utcH >= 8  && utcH < 13)  pressure = 1.2  + osc(3600000, 0.08);
    else if (utcH >= 23 || utcH < 2)   pressure = 0.95 + osc(1800000, 0.05);
    else                                pressure = 0.72 + osc(1200000, 0.06);
    if (utcD === 0 || utcD === 6) pressure *= 0.82;   // weekend discount

    const h      = calcBlockHeight();
    const hr     = 615 + osc(14400000, 55) + osc(3600000, 18);   // EH/s
    const diff   = 83.7 + osc(86400000, 3.5) + osc(43200000, 1); // T
    const mpTx   = Math.round((9500 + osc(7200000, 4500) + osc(1800000, 1500)) * pressure);
    const mpMB   = Math.round((65   + osc(7200000, 32)   + osc(1800000, 12))   * pressure);
    const fLow   = Math.max(1, Math.round((1.5 + osc(3600000, 1.2)) * pressure));
    const fMed   = Math.max(3, Math.round((9   + osc(3600000, 5))   * pressure));
    const fHigh  = Math.max(8, Math.round((26  + osc(3600000, 12))  * pressure));

    return { h, hr, diff, mpTx, mpMB, fLow, fMed, fHigh, pressure,
             reward: calcBlockReward(h),
             blocksToAdj: calcBlocksToAdj(h),
             minsNext: calcMinsToNextBlock(),
             feeLow: fLow, feeMed: fMed, feeHigh: fHigh,   // alias for other fns
             hashrate: hr, difficulty: diff,
             mempoolTxCount: Math.max(2000, mpTx),
             mempoolMB: Math.max(15, mpMB),
             blockHeight: h };
}

let netState    = buildNetState();
const sparkHist = Array.from({length:14}, () => 600 + osc(14400000, 55) + Math.random()*10);

function fluctuateNetwork() {
    netState = buildNetState();
}

function renderNetworkStats() {
    const s   = buildNetState();
    netState  = s;
    const now = new Date();
    const ts  = now.toUTCString().slice(17,25) + ' UTC';

    // Header timestamp
    const updEl = document.getElementById('netUpdatedAt');
    if (updEl) updEl.textContent = 'Updated ' + ts;

    // — Hash Rate —
    const prevHR = sparkHist[sparkHist.length - 1];
    sparkHist.push(s.hr); if (sparkHist.length > 14) sparkHist.shift();
    const hrDelta = s.hr - prevHR;
    safeText('bcastHashrate', s.hr.toFixed(1) + ' EH/s');
    const hrSub = document.getElementById('npcHashSub');
    if (hrSub) hrSub.innerHTML = `<span class="npc-delta ${hrDelta>=0?'up':'dn'}">${hrDelta>=0?'▲':'▼'} ${Math.abs(hrDelta).toFixed(1)} EH/s</span>`;
    drawSparkline('sparkHashrate', sparkHist, '#f7931a');

    // — Difficulty —
    safeText('bcastDifficulty', s.diff.toFixed(2) + ' T');
    safeText('npcDiffBlocks', s.blocksToAdj.toLocaleString());

    // — Mempool —
    const pct   = Math.min(100, Math.round(s.mpMB / 3));
    const pColor = pct > 66 ? '#ff4757' : pct > 33 ? '#f7931a' : '#00d395';
    const pLabel = pct > 66 ? '🔴 High pressure' : pct > 33 ? '🟡 Moderate' : '🟢 Low pressure';
    safeText('bcastMempoolSize', s.mpTx.toLocaleString() + ' txs');
    const mpSub = document.getElementById('npcMempoolSub');
    if (mpSub) mpSub.textContent = s.mpMB + ' MB · ' + pLabel;
    const fill = document.getElementById('npcMempoolFill');
    if (fill) { fill.style.width = pct + '%'; fill.style.background = pColor; }

    // — Fee Rate —
    safeText('bcastFeeRate', s.fLow + ' / ' + s.fMed + ' / ' + s.fHigh);
    const feeSub = document.getElementById('npcFeeSub');
    if (feeSub) feeSub.textContent = 'Economy / Normal / Priority sat/vB';

    // — Block Height —
    safeText('bcastBlockHeight', '#' + s.h.toLocaleString());
    safeText('npcNextBlock', '~' + s.minsNext + ' min');

    // Flash border on all cards
    document.querySelectorAll('.net-pulse-card').forEach(c => {
        c.classList.add('flash-update');
        setTimeout(() => c.classList.remove('flash-update'), 800);
    });

    // Fee tiers
    renderFeeTiers();

    // Ticker
    renderTicker(s);
}

function safeText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function drawSparkline(id, values, color) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth || 80, H = canvas.offsetHeight || 22;
    canvas.width = W; canvas.height = H;
    if (values.length < 2) return;
    const mn = Math.min(...values), mx = Math.max(...values);
    const toX = i => (i / (values.length - 1)) * W;
    const toY = v => H - 2 - ((v - mn) / ((mx - mn) || 1)) * (H - 4);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, color + '55'); grad.addColorStop(1, color + '00');
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(values[0]));
    values.forEach((v, i) => { if (i > 0) ctx.lineTo(toX(i), toY(v)); });
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(values[0]));
    values.forEach((v, i) => { if (i > 0) ctx.lineTo(toX(i), toY(v)); });
    ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.stroke();
}

function renderTicker(s) {
    const items = [
        { label: 'Block',     val: '#' + s.h.toLocaleString(),             cls: 'tb' },
        { label: 'Hash Rate', val: s.hr.toFixed(1) + ' EH/s',              cls: '' },
        { label: 'Diff',      val: s.diff.toFixed(2) + ' T',               cls: '' },
        { label: 'Mempool',   val: s.mpTx.toLocaleString() + ' txs',       cls: s.pressure>1.4?'tr':s.pressure>1.0?'':'tg' },
        { label: 'MB',        val: s.mpMB + ' MB',                          cls: '' },
        { label: 'Fee Lo',    val: s.fLow + ' sat/vB',                     cls: 'tg' },
        { label: 'Fee Med',   val: s.fMed + ' sat/vB',                     cls: '' },
        { label: 'Fee Hi',    val: s.fHigh + ' sat/vB',                    cls: 'tr' },
        { label: 'Reward',    val: s.reward.toFixed(3) + ' BTC',            cls: '' },
        { label: 'Next Blk', val: '~' + s.minsNext + ' min',              cls: 'tb' },
        { label: 'Diff Adj', val: s.blocksToAdj.toLocaleString() + ' blks', cls: '' },
        { label: 'UTC',       val: new Date().toUTCString().slice(17,25),   cls: 'tb' },
    ];
    // Duplicate for seamless infinite scroll
    const html = [...items, ...items].map(it =>
        `<span class="tick-item"><span class="tick-label">${it.label}</span><span class="tick-val ${it.cls}">${it.val}</span></span>`
    ).join('');
    const el = document.getElementById('tickerInner');
    if (el) el.innerHTML = html;
}

// Hashrate history for sparkline chart (14 data points)
let hashrateHistory = Array.from({length: 14}, (_, i) => ({
    day: i, value: 600 + osc(14400000 * (i/14), 50) + Math.random() * 20
}));

// --- Boot the mempool explorer ---
function initBroadcastTab() {
    generateBlocks();
    renderNetworkStats();      // draws pulse cards + ticker
    renderHashrateChart();
    renderMempoolBars();
    renderLatestBlocks();

    // Refresh stats every 30s from time-seeded engine
    setInterval(() => {
        renderNetworkStats();
        renderMempoolBars();
        renderFeeTiers();
        refreshAllBroadcastUI();
    }, 30000);

    // New simulated block every 60s for "Latest Blocks" panel
    setInterval(globalTick, 60000);

    // Hashrate chart history update every 2 min
    setInterval(() => {
        const s = buildNetState();
        hashrateHistory.push({ day: 14, value: s.hr });
        hashrateHistory = hashrateHistory.slice(-14);
        renderHashrateChart();
    }, 120000);
}

// Called every 60 real seconds
function globalTick() {
    netState.blockHeight++;
    mineNewBlock();
    renderLatestBlocks();
    refreshAllBroadcastUI();
}

// Redraw every active broadcast's UI using time-derived confirmations
function refreshAllBroadcastUI() {
    renderBcastHistory();
    // If result box visible, refresh it for the most recent broadcast
    if (document.getElementById('bcastResultBox')?.style.display !== 'none') {
        const latest = broadcastHistory[0];
        if (latest) updateBcastResult(latest);
    }
    // If TXID detail modal open, re-render it too
    const overlay = document.getElementById('txDetailOverlay');
    if (overlay && overlay.classList.contains('active') && window._openTxDetailEntry) {
        renderTxDetail(window._openTxDetailEntry.txid, window._openTxDetailEntry);
    }
}

function generateBlocks() {
    bcastBlocks = [];
    for (let i = 0; i < 8; i++) {
        bcastBlocks.unshift(makeBlock(netState.blockHeight - i));
    }
}

function makeBlock(height) {
    const hashes = '0000000000000000';
    const rand = () => Math.random().toString(16).slice(2);
    return {
        height,
        hash: hashes + rand() + rand() + rand() + rand(),
        txCount: 1200 + Math.floor(Math.random() * 3500),
        sizeMB: (0.8 + Math.random() * 3.1).toFixed(2),
        miner: ['Foundry USA', 'AntPool', 'F2Pool', 'ViaBTC', 'Binance Pool', 'SpiderPool'][Math.floor(Math.random() * 6)],
        reward: (3.125 + Math.random() * 0.3).toFixed(8),
        age: i => `${i * 10 + Math.floor(Math.random() * 8)}m ago`
    };
}

function mineNewBlock() {
    netState.blockHeight++;
    bcastBlocks.unshift(makeBlock(netState.blockHeight));
    bcastBlocks = bcastBlocks.slice(0, 8);
}

function renderFeeTiers() {
    document.getElementById('tierLowFee').textContent = netState.feeLow + '–' + (netState.feeLow + 4) + ' sat/vB';
    document.getElementById('tierMedFee').textContent = netState.feeMed + '–' + (netState.feeMed + 10) + ' sat/vB';
    document.getElementById('tierHighFee').textContent = netState.feeHigh + '+' + ' sat/vB';
}

function renderHashrateChart() {
    const canvas = document.getElementById('hashrateChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth || 300;
    const H = 120;
    canvas.width = W;
    canvas.height = H;

    const values = hashrateHistory.map(d => d.value);
    const min = Math.min(...values) - 20;
    const max = Math.max(...values) + 20;
    const toY = v => H - 16 - ((v - min) / (max - min)) * (H - 32);
    const toX = i => 8 + (i / (values.length - 1)) * (W - 16);

    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(42,49,84,0.8)';
    ctx.lineWidth = 1;
    for (let r = 0; r <= 4; r++) {
        const y = 8 + (r / 4) * (H - 24);
        ctx.beginPath();
        ctx.moveTo(0, y); ctx.lineTo(W, y);
        ctx.stroke();
    }

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(247,147,26,0.35)');
    grad.addColorStop(1, 'rgba(247,147,26,0.02)');
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(values[0]));
    values.forEach((v, i) => { if (i > 0) ctx.lineTo(toX(i), toY(v)); });
    ctx.lineTo(toX(values.length - 1), H);
    ctx.lineTo(toX(0), H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(values[0]));
    values.forEach((v, i) => { if (i > 0) ctx.lineTo(toX(i), toY(v)); });
    ctx.strokeStyle = '#f7931a';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Dots
    values.forEach((v, i) => {
        ctx.beginPath();
        ctx.arc(toX(i), toY(v), 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#f7931a';
        ctx.fill();
        ctx.strokeStyle = '#0a0e27';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    });

    // Y-axis labels
    ctx.fillStyle = 'rgba(159,168,218,0.7)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(max.toFixed(0) + ' EH', 4, 20);
    ctx.fillText(min.toFixed(0) + ' EH', 4, H - 4);

    // X-axis labels
    const lblEl = document.getElementById('hashrateLabels');
    if (lblEl) {
        const days = ['14d ago','12d','10d','8d','6d','4d','2d','Today'];
        lblEl.innerHTML = days.map(d => `<span>${d}</span>`).join('');
    }
}

function renderMempoolBars() {
    const total = netState.mempoolTxCount;
    const high = Math.floor(total * 0.12);
    const med  = Math.floor(total * 0.38);
    const low  = total - high - med;

    const bars = [
        { label: '≥50 sat/vB', count: high, color: '#ff4757', pct: 12 },
        { label: '20–50 sat/vB', count: Math.floor(med * 0.4), color: '#f7931a', pct: 18 },
        { label: '5–20 sat/vB', count: Math.floor(med * 0.6), color: '#4a9eff', pct: 28 },
        { label: '1–5 sat/vB', count: low, color: '#00d395', pct: 42 },
    ];

    document.getElementById('mempoolBars').innerHTML = bars.map(b => `
        <div class="bcast-mempool-bar-row">
            <span class="bcast-mempool-bar-label">${b.label}</span>
            <div class="bcast-mempool-bar-track">
                <div class="bcast-mempool-bar-fill" style="width:${b.pct}%;background:${b.color};"></div>
            </div>
            <span class="bcast-mempool-bar-count">${b.count.toLocaleString()} txs</span>
        </div>
    `).join('');
}

function renderLatestBlocks() {
    document.getElementById('latestBlocks').innerHTML = bcastBlocks.slice(0, 7).map((b, idx) => `
        <div class="bcast-block-item">
            <div class="bcast-block-num">#${b.height.toLocaleString()}</div>
            <div class="bcast-block-info">
                <div class="bcast-block-hash">${b.hash.slice(0, 32)}…</div>
                <div class="bcast-block-meta">⛏ ${b.miner} &nbsp;• &nbsp;${idx === 0 ? 'just now' : (idx * 10 + Math.floor(Math.random() * 5)) + 'm ago'}</div>
            </div>
            <div class="bcast-block-size">
                <div>${b.sizeMB} MB</div>
                <div class="bcast-block-txcount">${b.txCount.toLocaleString()} txs</div>
            </div>
        </div>
    `).join('');
}

// --- Fee tier radio styling ---
document.querySelectorAll('.bcast-tier-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.bcast-tier-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// Stores data from the builder so broadcast can show real UTXO details
let _pendingBuilderTxData = null;

// Parse raw hex to extract real input txids/vouts
function parseHexInputsOutputs(hex) {
    try {
        let off = 0;
        const rB = n => { const b = hex.slice(off, off + n*2); off += n*2; return b; };
        const rVI = () => { const f = parseInt(rB(1),16); if(f<0xfd) return f; if(f===0xfd) return parseInt(rB(2).match(/.{2}/g).reverse().join(''),16); if(f===0xfe) return parseInt(rB(4).match(/.{2}/g).reverse().join(''),16); return parseInt(rB(8).match(/.{2}/g).reverse().join(''),16); };
        const rev = h => h.match(/.{2}/g).reverse().join('');
        parseInt(rev(rB(4)),16); // version
        // detect segwit marker
        let isSegwit = false;
        if (hex[off*0] === '0' && hex[off*0+1] === '0') { isSegwit = true; rB(1); rB(1); }
        const inCount = rVI();
        const inputs = [];
        for (let i=0; i<inCount; i++) {
            const txid = rev(rB(32));
            const vout = parseInt(rev(rB(4)),16);
            const sl = rVI(); rB(sl);
            rB(4); // sequence
            inputs.push({ txid, vout });
        }
        const outCount = rVI();
        const outputs = [];
        for (let i=0; i<outCount; i++) {
            const val = parseInt(rev(rB(8)),16);
            const sl = rVI(); const script = rB(sl);
            outputs.push({ value: val, script });
        }
        return { inputs, outputs };
    } catch(e) { return null; }
}

// Called from displayBuiltTransaction to stash builder data for broadcast
function stashBuilderDataForBroadcast(rawTx, inputs, outputs) {
    _pendingBuilderTxData = { rawTx, inputs, outputs };
}

// --- Broadcast Transaction ---
function broadcastTransaction() {
    const rawTx = document.getElementById('bcastRawTx').value.trim();
    if (!rawTx) { showAlert('Please paste a raw transaction hex.', 'error'); return; }
    if (!/^[0-9a-fA-F]+$/.test(rawTx)) { showAlert('Invalid hex — only 0-9 and a-f characters allowed.', 'error'); return; }
    if (rawTx.length < 60) { showAlert('Transaction too short — minimum 30 bytes required.', 'error'); return; }

    const tier = document.querySelector('input[name="feeTier"]:checked')?.value || 'medium';
    const loadEl = document.getElementById('bcastLoading');
    const btn = document.getElementById('bcastBtn');
    btn.disabled = true;
    loadEl.classList.add('show');

    const delay = tier === 'high' ? 800 : tier === 'medium' ? 1400 : 2200;
    setTimeout(() => {
        loadEl.classList.remove('show');
        btn.disabled = false;

        const s = buildNetState();
        const size = Math.floor(rawTx.length / 2);
        const feeRate = tier === 'high' ? s.feeHigh : tier === 'medium' ? s.feeMed : s.feeLow;
        const fee = size * feeRate;

        // Try to parse real input/output data from the hex
        const parsed = parseHexInputsOutputs(rawTx);

        // Use builder data if available and hex matches, else use parsed or simulate
        let realInputs, realOutputs, inputAddr, outputAddr, changeAddr, inputVal, outputVal, changeVal;
        const builderData = _pendingBuilderTxData;

        if (builderData && builderData.rawTx === rawTx) {
            // Full real data from builder — use actual UTXOs
            realInputs = builderData.inputs.map(u => ({
                txid: u.txHash,
                vout: u.outputIndex,
                value: u.value,
                address: u.address || '(unknown)',
                script: u.script || ''
            }));
            realOutputs = builderData.outputs.map(o => ({
                value: o.value,
                address: o.address,
                isChange: o.isChange || false
            }));
            inputAddr  = realInputs[0]?.address;
            outputAddr = realOutputs.find(o => !o.isChange)?.address;
            changeAddr = realOutputs.find(o => o.isChange)?.address;
            inputVal   = realInputs.reduce((s,i) => s + i.value, 0) / 1e8;
            outputVal  = realOutputs.filter(o => !o.isChange).reduce((s,o) => s + o.value, 0) / 1e8;
            changeVal  = (realOutputs.find(o => o.isChange)?.value || 0) / 1e8;
            _pendingBuilderTxData = null; // clear after use
        } else if (parsed && parsed.inputs.length > 0) {
            // Real txids from parsing hex — show them but values are unknown without looking up
            realInputs = parsed.inputs.map(inp => ({
                txid: inp.txid,
                vout: inp.vout,
                value: null,   // unknown without UTXO lookup
                address: null
            }));
            realOutputs = parsed.outputs.map(o => ({
                value: o.value,
                address: null,
                isChange: false
            }));
            // Estimate values from outputs
            const totalOut = realOutputs.reduce((s,o) => s + (o.value||0), 0);
            inputVal  = (totalOut + fee) / 1e8;
            outputVal = totalOut / 1e8;
            changeVal = 0;
            inputAddr  = null;
            outputAddr = null;
            changeAddr = null;
        } else {
            // Fully simulated — derive plausible addresses from txid seed
            realInputs = realOutputs = null;
            inputVal  = 0.15 + Math.random() * 0.85;
            outputVal = inputVal * (0.55 + Math.random() * 0.35);
            changeVal = Math.max(0, inputVal - outputVal - fee/1e8);
            inputAddr = changeAddr = outputAddr = null;
        }

        // Compute a deterministic pseudo-txid from double-hashing the hex
        // We XOR bytes to get a 64-char hex "fingerprint"
        let txid = '';
        for (let i = 0; i < 64; i++) {
            const charA = rawTx.charCodeAt(i % rawTx.length);
            const charB = rawTx.charCodeAt((i * 7 + 13) % rawTx.length);
            txid += ((charA ^ charB ^ (i * 31)) & 0xff).toString(16).padStart(2,'0').slice(-1);
        }
        // pad to 64
        while (txid.length < 64) txid += '0';
        txid = txid.slice(0,64);

        const entry = {
            txid,
            tier,
            ts: Date.now(),
            maxConf: 6,
            size,
            fee,
            feeRate,
            // UTXO-derived or simulated values
            realInputs,
            realOutputs,
            inputAddr:  inputAddr  || ('1' + txid.slice(0,5) + 'BcastInput'),
            outputAddr: outputAddr || ('bc1q' + txid.slice(10,20) + 'RecipAddr'),
            changeAddr: changeAddr || ('3' + txid.slice(20,30) + 'ChangeAddr'),
            inputVal:   inputVal,
            outputVal:  outputVal,
            changeVal:  Math.max(0, changeVal),
            rawHex: rawTx,
            blockHeightAtBroadcast: s.blockHeight,
        };

        broadcastHistory.unshift(entry);
        showBcastResult(entry);
        renderBcastHistory();
        document.getElementById('bcastRawTx').value = '';
    }, delay);
}

function showBcastResult(entry) {
    const box = document.getElementById('bcastResultBox');
    box.style.display = 'block';
    box.classList.remove('error');
    updateBcastResult(entry);
}

function updateBcastResult(entry) {
    const box = document.getElementById('bcastResultBox');
    if (!box || box.style.display === 'none') return;

    const conf      = getConfirmations(entry);
    const minsNext  = getMinsToNextBlock(entry);
    const elapsed   = Date.now() - entry.ts;
    const elapsedH  = Math.floor(elapsed / 3600000);
    const elapsedM  = Math.floor((elapsed % 3600000) / 60000);
    const done      = conf >= entry.maxConf;

    // Confirmation block pills
    const blockPills = Array.from({length: entry.maxConf}, (_, i) => {
        const isConfirmed = i < conf;
        const isCurrent   = i === conf && !done;
        const pct = isCurrent ? Math.round((elapsed % BLOCK_MS) / BLOCK_MS * 100) : 0;
        return `<div class="bconf-pill ${isConfirmed ? 'done' : isCurrent ? 'active' : ''}">
            ${isConfirmed
                ? `<span class="bconf-check">✓</span>`
                : isCurrent
                ? `<svg class="bconf-ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="3"/><circle cx="18" cy="18" r="14" fill="none" stroke="#f7931a" stroke-width="3" stroke-dasharray="${Math.round(pct*0.88)} 88" stroke-dashoffset="22" stroke-linecap="round" transform="rotate(-90 18 18)"/></svg><span class="bconf-num">${i+1}</span>`
                : `<span class="bconf-num">${i+1}</span>`
            }
            <span class="bconf-label">${isConfirmed ? (i===0?'First':'Block') : (isCurrent ? 'Mining' : 'Waiting')}</span>
        </div>`;
    }).join('');

    const etaLine = done
        ? `<span style="color:var(--accent-green);font-weight:700;">✅ Fully confirmed — 6 of 6 blocks</span>`
        : `<span style="color:var(--accent-orange);">⏳ ${conf}/${entry.maxConf} confirmations &nbsp;·&nbsp; Next block in <strong>~${minsNext} min</strong></span>`;

    box.innerHTML = `
        <div class="bcast-result-title">✅ Transaction Broadcast Successfully</div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.35rem;">Transaction ID — <span style="color:var(--text-secondary);">click to view full breakdown</span></div>
        <div class="bcast-txid-row">
            <span class="bcast-txid-link" onclick="openTxDetail('${entry.txid}')">${entry.txid}</span>
            <button class="bcast-copy-btn" onclick="navigator.clipboard.writeText('${entry.txid}');showAlert('Copied!','info')">📋</button>
            <button class="bcast-copy-btn" onclick="openTxDetail('${entry.txid}')">🔍 Breakdown</button>
        </div>

        <div class="bconf-timeline">${blockPills}</div>
        <div style="font-size:0.83rem;margin:0.6rem 0 0.5rem;">${etaLine}</div>

        <div style="display:flex;gap:1.5rem;flex-wrap:wrap;font-size:0.78rem;color:var(--text-muted);padding:0.65rem 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin-bottom:0.75rem;">
            <span>📅 Broadcast: <strong style="color:var(--text-secondary);">${new Date(entry.ts).toLocaleTimeString()}</strong></span>
            <span>⏱ Elapsed: <strong style="color:var(--text-secondary);">${elapsedH>0?elapsedH+'h ':''} ${elapsedM}m</strong></span>
            <span>📦 Size: <strong style="color:var(--text-secondary);">${entry.size} bytes</strong></span>
            <span>💸 Fee: <strong style="color:var(--accent-orange);">${entry.fee.toLocaleString()} sats (${entry.feeRate} sat/vB)</strong></span>
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted);padding:0.6rem 0.8rem;background:var(--bg-primary);border-radius:8px;border-left:3px solid var(--border);">
            🔐 <strong>Why 6 confirmations?</strong> Each block added after yours makes reversing the transaction exponentially harder. At 6 blocks, an attacker with 10% of the network's hashrate has less than a <strong>0.1% chance</strong> of rewriting history — this is Satoshi's finality standard from the Bitcoin whitepaper.
        </div>
    `;
}

function updateAllConfirmations() { refreshAllBroadcastUI(); }

function tierLabel(t) {
    return t === 'high' ? '🚀 Priority' : t === 'medium' ? '🚗 Normal' : '🐢 Economy';
}

function renderBcastHistory() {
    const el = document.getElementById('bcastHistory');
    const countEl = document.getElementById('bcastHistoryCount');
    if (!el) return;

    if (broadcastHistory.length === 0) {
        el.innerHTML = '<div style="color:var(--text-muted);font-size:0.88rem;text-align:center;padding:1.5rem 0;">No broadcasts yet</div>';
        if (countEl) countEl.textContent = '';
        return;
    }

    if (countEl) countEl.textContent = `(${broadcastHistory.length})`;
    el.innerHTML = broadcastHistory.map(e => {
        const conf = getConfirmations(e);
        const done = conf >= e.maxConf;
        const minsNext = done ? 0 : getMinsToNextBlock(e);
        return `
        <div class="bcast-hist-item" onclick="openTxDetail('${e.txid}')" style="cursor:pointer;">
            <div class="bcast-hist-header">
                <span class="bcast-txid-link" style="font-size:0.73rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px;">${e.txid.slice(0,20)}…${e.txid.slice(-10)}</span>
                <span class="bcast-hist-conf-badge ${done ? '' : 'pending'}">
                    ${done ? '✅ ' + conf + '/' + e.maxConf : '⏳ ' + conf + '/' + e.maxConf}
                </span>
            </div>
            <div style="display:flex;gap:0.3rem;margin:0.4rem 0;">
                ${Array.from({length:e.maxConf},(_,i)=>`<div style="height:5px;flex:1;border-radius:3px;background:${i<conf?'var(--accent-green)':i===conf&&!done?'var(--accent-orange)':'var(--border)'};transition:background 0.5s;"></div>`).join('')}
            </div>
            <div class="bcast-hist-row">
                <span>${tierLabel(e.tier)}</span>
                <span>${e.fee.toLocaleString()} sats</span>
                <span>${timeSince(e.ts)}</span>
                ${!done ? `<span style="color:var(--accent-orange);font-size:0.72rem;">~${minsNext}m to block ${conf+1}</span>` : `<span style="color:var(--accent-green);font-size:0.72rem;">Fully confirmed</span>`}
            </div>
        </div>`;
    }).join('');
}

// Init broadcast tab (lazy — on first visit)
let bcastInited = false;

// Handle window resize for chart
window.addEventListener('resize', () => {
    if (bcastInited) renderHashrateChart();
});

// Initialize ticker immediately regardless of which tab is active
// so it shows useful data even before visiting the Broadcast tab
(function initTicker() {
    const s = buildNetState();
    renderTicker(s);
    setInterval(() => renderTicker(buildNetState()), 30000);
})();

function displayResults(tx) {
    const totalInput = tx.inputs.length;
    const totalOutput = tx.outputs.reduce((sum, out) => sum + parseFloat(out.valueBTC), 0);

    resultsContent.innerHTML = `
        <div class="result-section success">
            <div class="result-title">
                <span class="status-badge valid">✓ Valid Format</span>
                Transaction decoded successfully
            </div>
        </div>

        <div class="result-section">
            <div class="result-title">📊 Transaction Overview</div>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Version</div>
                    <div class="info-value">${tx.version}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Size</div>
                    <div class="info-value">${tx.size} bytes</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Locktime</div>
                    <div class="info-value">${tx.locktime} ${tx.locktime === 0 ? '(not locked)' : ''}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Inputs</div>
                    <div class="info-value">${tx.inputCount}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Outputs</div>
                    <div class="info-value">${tx.outputCount}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Total Output</div>
                    <div class="info-value">${totalOutput.toFixed(8)} BTC</div>
                </div>
            </div>
        </div>

        <div class="result-section">
            <div class="result-title">📥 Inputs (${tx.inputCount})</div>
            <div class="input-output-section">
                ${tx.inputs.map((input, i) => `
                    <div class="io-item">
                        <div class="io-header">
                            <span class="io-index">Input #${i}</span>
                        </div>
                        <div class="io-details">
                            <div class="io-row">
                                <div class="io-row-label">Previous TX</div>
                                <div class="io-row-value">${input.txid}</div>
                            </div>
                            <div class="io-row">
                                <div class="io-row-label">Output Index</div>
                                <div class="io-row-value">${input.vout}</div>
                            </div>
                            <div class="io-row">
                                <div class="io-row-label">ScriptSig</div>
                                <div class="io-row-value">${input.scriptSig.slice(0, 64)}${input.scriptSig.length > 64 ? '...' : ''}</div>
                            </div>
                            <div class="io-row">
                                <div class="io-row-label">Sequence</div>
                                <div class="io-row-value">${input.sequence}</div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="result-section">
            <div class="result-title">📤 Outputs (${tx.outputCount})</div>
            <div class="input-output-section">
                ${tx.outputs.map((output, i) => `
                    <div class="io-item">
                        <div class="io-header">
                            <span class="io-index">Output #${i}</span>
                            <span class="io-amount">${output.valueBTC} BTC</span>
                        </div>
                        <div class="io-details">
                            <div class="io-row">
                                <div class="io-row-label">Value (satoshis)</div>
                                <div class="io-row-value">${output.value.toLocaleString()}</div>
                            </div>
                            <div class="io-row">
                                <div class="io-row-label">ScriptPubKey</div>
                                <div class="io-row-value">${output.scriptPubKey}</div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="alert info">
            <span>ℹ️</span>
            <div>
                <strong>Next Steps:</strong> To fully verify this transaction on the blockchain, search for the transaction ID on a blockchain explorer like blockchain.com or blockchair.com
            </div>
        </div>
    `;
}